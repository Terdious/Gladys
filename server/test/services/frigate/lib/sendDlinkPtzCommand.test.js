const { expect, assert } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

const { BadParameters, ServiceNotConfiguredError } = require('../../../../utils/coreErrors');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const buildDevice = (params) => ({
  external_id: 'frigate:cam_boxes',
  params: Object.keys(params).map((name) => ({ name, value: params[name] })),
});

describe('frigate sendDlinkPtzCommand', () => {
  let axios;
  let frigateManager;

  beforeEach(() => {
    axios = {
      post: sinon.stub().resolves({ status: 200 }),
      get: sinon.stub().resolves({ status: 200 }),
    };
    const { sendDlinkPtzCommand } = proxyquire('../../../../services/frigate/lib/sendDlinkPtzCommand', {
      axios,
    });
    const FrigateManager = proxyquire('../../../../services/frigate/lib', {
      './sendDlinkPtzCommand': { sendDlinkPtzCommand },
    });
    frigateManager = new FrigateManager({}, null, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  const device = () =>
    buildDevice({
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_ONVIF_USERNAME: 'admin',
      FRIGATE_ONVIF_PASSWORD: 'admin-password',
    });

  it('should post a single-step move on the pan/tilt CGI', async () => {
    await frigateManager.sendDlinkPtzCommand(device(), 'MOVE_UP');

    const [url, body, options] = axios.post.firstCall.args;
    expect(url).to.equal('http://10.6.0.1:80/pantiltcontrol.cgi');
    expect(body).to.equal('PanSingleMoveDegree=5&TiltSingleMoveDegree=5&PanTiltSingleMove=1');
    expect(options.auth).to.deep.equal({ username: 'admin', password: 'admin-password' });
  });

  it('should map every direction to the D-Link matrix', async () => {
    await frigateManager.sendDlinkPtzCommand(device(), 'MOVE_LEFT');
    await frigateManager.sendDlinkPtzCommand(device(), 'MOVE_RIGHT');
    await frigateManager.sendDlinkPtzCommand(device(), 'MOVE_DOWN');

    expect(axios.post.getCall(0).args[1]).to.contain('PanTiltSingleMove=3');
    expect(axios.post.getCall(1).args[1]).to.contain('PanTiltSingleMove=5');
    expect(axios.post.getCall(2).args[1]).to.contain('PanTiltSingleMove=7');
  });

  it('should use the configured HTTP port', async () => {
    const deviceWithPort = buildDevice({
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_CAMERA_HTTP_PORT: '8080',
      FRIGATE_ONVIF_USERNAME: 'admin',
      FRIGATE_ONVIF_PASSWORD: 'admin-password',
    });

    await frigateManager.sendDlinkPtzCommand(deviceWithPort, 'MOVE_UP');

    expect(axios.post.firstCall.args[0]).to.equal('http://10.6.0.1:8080/pantiltcontrol.cgi');
  });

  it('should do nothing on STOP (moves are single steps)', async () => {
    await frigateManager.sendDlinkPtzCommand(device(), 'STOP');

    sinon.assert.notCalled(axios.post);
  });

  it('should surface HTTP failures', async () => {
    axios.post.rejects(new Error('Request failed with status code 401'));

    await assert.isRejected(
      frigateManager.sendDlinkPtzCommand(
        buildDevice({
          FRIGATE_SOURCE_HOST: '10.6.0.1',
          FRIGATE_ONVIF_USERNAME: 'admin',
          FRIGATE_ONVIF_PASSWORD: 'secret',
        }),
        'MOVE_UP',
      ),
      'Request failed with status code 401',
    );
  });

  it('should reject unsupported commands', async () => {
    await assert.isRejected(frigateManager.sendDlinkPtzCommand(device(), 'ZOOM_IN'), BadParameters);
    await assert.isRejected(frigateManager.sendDlinkPtzCommand(device(), 'preset_garden'), BadParameters);
  });

  it('should reject when control credentials are missing', async () => {
    const deviceWithoutCredentials = buildDevice({
      FRIGATE_SOURCE_HOST: '10.6.0.1',
    });

    await assert.isRejected(
      frigateManager.sendDlinkPtzCommand(deviceWithoutCredentials, 'MOVE_UP'),
      ServiceNotConfiguredError,
    );
  });
});
