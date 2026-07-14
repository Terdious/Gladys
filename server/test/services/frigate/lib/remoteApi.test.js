const { expect, assert } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

const { ServiceNotConfiguredError } = require('../../../../utils/coreErrors');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate remoteApi', () => {
  let axios;
  let frigateManager;

  beforeEach(() => {
    axios = {
      post: sinon.stub().resolves({
        headers: { 'set-cookie': ['frigate_token=my-jwt-token; Path=/; HttpOnly'] },
      }),
      get: sinon.stub().resolves({ data: { ok: true }, headers: {} }),
    };
    const { remoteLogin, remoteApiGet } = proxyquire('../../../../services/frigate/lib/remoteApi', {
      axios,
    });
    const FrigateManager = proxyquire('../../../../services/frigate/lib', {
      './remoteApi': { remoteLogin, remoteApiGet },
    });
    frigateManager = new FrigateManager({}, null, serviceId);
    frigateManager.remote = { host: '10.5.0.227', port: 8971, username: 'admin', password: 'secret' };
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should login and store the JWT token', async () => {
    await frigateManager.remoteLogin();

    expect(frigateManager.remoteAuthToken).to.equal('my-jwt-token');
    const [url, body] = axios.post.firstCall.args;
    expect(url).to.equal('https://10.5.0.227:8971/api/login');
    expect(body).to.deep.equal({ user: 'admin', password: 'secret' });
  });

  it('should reject when the login response has no token cookie', async () => {
    axios.post.resolves({ headers: {} });

    await assert.isRejected(frigateManager.remoteLogin(), ServiceNotConfiguredError);
  });

  it('should reject when the remote instance is not configured', async () => {
    frigateManager.remote = null;

    await assert.isRejected(frigateManager.remoteLogin(), ServiceNotConfiguredError);
  });

  it('should login once then send authenticated requests', async () => {
    const response = await frigateManager.remoteApiGet('/api/config');

    expect(response.data).to.deep.equal({ ok: true });
    sinon.assert.calledOnce(axios.post);
    const [url, options] = axios.get.firstCall.args;
    expect(url).to.equal('https://10.5.0.227:8971/api/config');
    expect(options.headers).to.deep.equal({ Authorization: 'Bearer my-jwt-token' });
  });

  it('should re-login and retry once on an expired token', async () => {
    frigateManager.remoteAuthToken = 'expired-token';
    const unauthorized = new Error('Request failed with status code 401');
    unauthorized.response = { status: 401 };
    axios.get.onFirstCall().rejects(unauthorized);
    axios.get.onSecondCall().resolves({ data: { ok: true }, headers: {} });

    const response = await frigateManager.remoteApiGet('/api/config');

    expect(response.data).to.deep.equal({ ok: true });
    sinon.assert.calledOnce(axios.post);
    sinon.assert.calledTwice(axios.get);
  });

  it('should rethrow non-authentication errors', async () => {
    frigateManager.remoteAuthToken = 'token';
    axios.get.rejects(new Error('ECONNREFUSED'));

    await assert.isRejected(frigateManager.remoteApiGet('/api/config'), 'ECONNREFUSED');
  });
});
