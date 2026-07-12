const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;
const proxyquire = require('proxyquire').noCallThru();

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate configureAdminUser', () => {
  let FrigateManager;
  let axios;
  let gladys;
  let frigateManager;

  beforeEach(() => {
    axios = {
      put: sinon.stub().resolves({}),
    };
    const { configureAdminUser } = proxyquire('../../../../services/frigate/lib/configureAdminUser', {
      axios,
    });
    FrigateManager = proxyquire('../../../../services/frigate/lib', {
      './configureAdminUser': { configureAdminUser },
    });

    gladys = {
      variable: {
        getValue: fake.resolves(null),
        setValue: fake.resolves(null),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.frigateApiPort = 5000;
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should do nothing when admin is already configured', async () => {
    frigateManager.adminConfigured = true;

    await frigateManager.configureAdminUser();

    assert.notCalled(gladys.variable.getValue);
    assert.notCalled(axios.put);
  });

  it('should keep existing password without calling Frigate', async () => {
    gladys.variable.getValue = fake.resolves('existing-password');

    await frigateManager.configureAdminUser();

    expect(frigateManager.adminConfigured).to.equal(true);
    assert.notCalled(axios.put);
    assert.notCalled(gladys.variable.setValue);
  });

  it('should do nothing when API port is not allocated yet', async () => {
    frigateManager.frigateApiPort = null;

    await frigateManager.configureAdminUser();

    expect(frigateManager.adminConfigured).to.equal(false);
    assert.notCalled(axios.put);
  });

  it('should set a generated admin password through the internal Frigate API', async () => {
    await frigateManager.configureAdminUser();

    assert.calledOnce(axios.put);
    const [url, body] = axios.put.firstCall.args;
    expect(url).to.equal('http://127.0.0.1:5000/api/users/admin/password');
    expect(body.password).to.have.lengthOf(20);
    assert.calledOnceWithExactly(gladys.variable.setValue, 'FRIGATE_ADMIN_PASSWORD', body.password, serviceId);
    expect(frigateManager.adminConfigured).to.equal(true);
  });

  it('should not store the password when the Frigate API call fails', async () => {
    axios.put.rejects(new Error('ECONNREFUSED'));

    await frigateManager.configureAdminUser();

    assert.notCalled(gladys.variable.setValue);
    expect(frigateManager.adminConfigured).to.equal(false);
  });
});
