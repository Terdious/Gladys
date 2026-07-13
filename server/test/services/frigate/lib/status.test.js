const { expect } = require('chai');

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate status', () => {
  it('should return default status', () => {
    const frigateManager = new FrigateManager({}, null, serviceId);
    const status = frigateManager.status();
    expect(status).to.deep.equal({
      dockerBased: false,
      networkModeValid: false,
      frigateEnabled: false,
      mqttExist: false,
      mqttRunning: false,
      frigateExist: false,
      frigateRunning: false,
      gladysConnected: false,
      frigateConnected: false,
      vaapiAvailable: false,
      mqttPort: null,
      frigateUiPort: null,
      frigateApiPort: null,
      frigateRtspPort: null,
    });
  });

  it('should return current status', () => {
    const frigateManager = new FrigateManager({}, null, serviceId);
    frigateManager.dockerBased = true;
    frigateManager.networkModeValid = true;
    frigateManager.frigateEnabled = true;
    frigateManager.mqttExist = true;
    frigateManager.mqttRunning = true;
    frigateManager.frigateExist = true;
    frigateManager.frigateRunning = true;
    frigateManager.gladysConnected = true;
    frigateManager.frigateConnected = true;
    frigateManager.vaapiAvailable = true;
    frigateManager.mqttPort = 1885;
    frigateManager.frigateUiPort = 8971;
    frigateManager.frigateApiPort = 5000;
    frigateManager.frigateRtspPort = 8554;
    const status = frigateManager.status();
    expect(status).to.deep.equal({
      dockerBased: true,
      networkModeValid: true,
      frigateEnabled: true,
      mqttExist: true,
      mqttRunning: true,
      frigateExist: true,
      frigateRunning: true,
      gladysConnected: true,
      frigateConnected: true,
      vaapiAvailable: true,
      mqttPort: 1885,
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
    });
  });
});
