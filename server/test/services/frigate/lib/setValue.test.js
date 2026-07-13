const { expect, assert } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

const { BadParameters, NotFoundError, ServiceNotConfiguredError } = require('../../../../utils/coreErrors');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const buildDevice = (params) => ({
  external_id: 'frigate:cam_boxes',
  params: Object.keys(params).map((name) => ({ name, value: params[name] })),
});

const nightModeFeature = { external_id: 'frigate:cam_boxes:nightmode' };

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

  const device = () =>
    buildDevice({
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_NIGHT_MODE_PROTOCOL: 'dlink-http',
      FRIGATE_ONVIF_USERNAME: 'admin',
      FRIGATE_ONVIF_PASSWORD: 'admin-password',
    });

  it('should force the night mode when turned on', async () => {
    await frigateManager.setValue(device(), nightModeFeature, 1);

    const [url, options] = axios.get.firstCall.args;
    expect(url).to.equal('http://10.6.0.1:80/daynight.cgi?DayNightMode=3&ConfigReboot=no');
    expect(options.auth).to.deep.equal({ username: 'admin', password: 'admin-password' });
  });

  it('should go back to the automatic mode when turned off', async () => {
    await frigateManager.setValue(device(), nightModeFeature, 0);

    expect(axios.get.firstCall.args[0]).to.equal('http://10.6.0.1:80/daynight.cgi?DayNightMode=0&ConfigReboot=no');
  });

  it('should reject a feature that is not controllable', async () => {
    await assert.isRejected(
      frigateManager.setValue(device(), { external_id: 'frigate:cam_boxes:person' }, 1),
      NotFoundError,
    );
  });

  it('should reject a feature without external id', async () => {
    await assert.isRejected(frigateManager.setValue(device(), {}, 1), NotFoundError);
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
