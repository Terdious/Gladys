const { expect, assert } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

const { fake, assert: fakeAssert } = sinon;

const { BadParameters, NotFoundError, ServiceNotConfiguredError } = require('../../../../utils/coreErrors');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const buildDevice = (params) => ({
  selector: 'my-camera',
  external_id: 'frigate:cam_boxes',
  params: Object.keys(params).map((name) => ({ name, value: params[name] })),
});

const nightModeFeature = { external_id: 'frigate:cam_boxes:nightmode', type: 'night-mode' };

describe('frigate setValue', () => {
  let axios;
  let frigateManager;

  beforeEach(() => {
    axios = {
      get: sinon.stub().resolves({ status: 200 }),
    };
    const { setValue } = proxyquire('../../../../services/frigate/lib/setValue', {
      axios,
    });
    const FrigateManager = proxyquire('../../../../services/frigate/lib', {
      './setValue': { setValue },
    });
    frigateManager = new FrigateManager({}, null, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  const dlinkDevice = () =>
    buildDevice({
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_PTZ_PROTOCOL: 'dlink-http',
      FRIGATE_NIGHT_MODE_PROTOCOL: 'dlink-http',
      FRIGATE_ONVIF_USERNAME: 'admin',
      FRIGATE_ONVIF_PASSWORD: 'admin-password',
    });

  it('should force the night mode when turned on', async () => {
    await frigateManager.setValue(dlinkDevice(), nightModeFeature, 1);

    const [url, options] = axios.get.firstCall.args;
    expect(url).to.equal('http://10.6.0.1:80/daynight.cgi?DayNightMode=3&ConfigReboot=no');
    expect(options.auth).to.deep.equal({ username: 'admin', password: 'admin-password' });
  });

  it('should go back to the automatic mode when turned off', async () => {
    await frigateManager.setValue(dlinkDevice(), nightModeFeature, 0);

    expect(axios.get.firstCall.args[0]).to.equal('http://10.6.0.1:80/daynight.cgi?DayNightMode=0&ConfigReboot=no');
  });

  it('should route a pan move to the D-Link driver', async () => {
    frigateManager.sendDlinkPtzCommand = fake.resolves(null);
    const device = dlinkDevice();

    await frigateManager.setValue(device, { type: 'pan' }, -1);

    fakeAssert.calledOnceWithExactly(frigateManager.sendDlinkPtzCommand, device, 'MOVE_LEFT');
  });

  it('should route a tilt move to the D-Link driver', async () => {
    frigateManager.sendDlinkPtzCommand = fake.resolves(null);
    const device = dlinkDevice();

    await frigateManager.setValue(device, { type: 'tilt' }, 1);

    fakeAssert.calledOnceWithExactly(frigateManager.sendDlinkPtzCommand, device, 'MOVE_UP');
  });

  it('should do nothing on a D-Link stop (moves are single steps)', async () => {
    frigateManager.sendDlinkPtzCommand = fake.resolves(null);

    await frigateManager.setValue(dlinkDevice(), { type: 'pan' }, 0);

    fakeAssert.notCalled(frigateManager.sendDlinkPtzCommand);
  });

  it('should reject an invalid D-Link PTZ value', async () => {
    frigateManager.sendDlinkPtzCommand = fake.resolves(null);

    await assert.isRejected(frigateManager.setValue(dlinkDevice(), { type: 'pan' }, 5), BadParameters);
  });

  it('should route PTZ moves of ONVIF cameras to the Frigate MQTT topic', async () => {
    frigateManager.sendPtzCommand = fake.resolves(null);
    const device = buildDevice({ FRIGATE_SOURCE_HOST: '192.168.1.10' });

    await frigateManager.setValue(device, { type: 'zoom' }, 1);
    await frigateManager.setValue(device, { type: 'tilt' }, 0);

    fakeAssert.calledWith(frigateManager.sendPtzCommand.getCall(0), 'my-camera', 'ZOOM_IN');
    fakeAssert.calledWith(frigateManager.sendPtzCommand.getCall(1), 'my-camera', 'STOP');
  });

  it('should reject an invalid ONVIF PTZ value', async () => {
    frigateManager.sendPtzCommand = fake.resolves(null);
    const device = buildDevice({ FRIGATE_SOURCE_HOST: '192.168.1.10' });

    await assert.isRejected(frigateManager.setValue(device, { type: 'pan' }, 5), BadParameters);
  });

  it('should reject a feature that is not controllable', async () => {
    await assert.isRejected(
      frigateManager.setValue(dlinkDevice(), { external_id: 'frigate:cam_boxes:person', type: 'person-detection' }, 1),
      NotFoundError,
    );
  });

  it('should surface a night mode HTTP failure', async () => {
    axios.get.rejects(new Error('Request failed with status code 401'));

    await assert.isRejected(
      frigateManager.setValue(dlinkDevice(), { type: 'night-mode', external_id: 'frigate:cam_boxes:nightmode' }, 1),
      'Request failed with status code 401',
    );
  });

  it('should reject when the camera has no night mode protocol', async () => {
    const deviceWithoutProtocol = buildDevice({
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_ONVIF_USERNAME: 'admin',
      FRIGATE_ONVIF_PASSWORD: 'admin-password',
    });

    await assert.isRejected(frigateManager.setValue(deviceWithoutProtocol, nightModeFeature, 1), BadParameters);
  });

  it('should reject when control credentials are missing', async () => {
    const deviceWithoutCredentials = buildDevice({
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_NIGHT_MODE_PROTOCOL: 'dlink-http',
    });

    await assert.isRejected(
      frigateManager.setValue(deviceWithoutCredentials, nightModeFeature, 1),
      ServiceNotConfiguredError,
    );
  });
});
