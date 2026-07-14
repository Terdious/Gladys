const { expect } = require('chai');

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate status', () => {
  it('should return default status', () => {
    const frigateManager = new FrigateManager({}, null, serviceId);
    const status = frigateManager.status();
    expect(status).to.deep.equal({
      mode: 'local',
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
      openvinoCapable: false,
      renderDevicePath: null,
      coralAvailable: false,
      coralDeviceType: null,
      detector: 'auto',
      configPendingRestart: false,
      remoteConnectionError: null,
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
    frigateManager.openvinoCapable = true;
    frigateManager.renderDevicePath = '/dev/dri/renderD128';
    frigateManager.coralAvailable = true;
    frigateManager.coralDeviceType = 'usb';
    frigateManager.detector = 'coral';
    frigateManager.configPendingRestart = true;
    frigateManager.mqttPort = 1885;
    frigateManager.frigateUiPort = 8971;
    frigateManager.frigateApiPort = 5000;
    frigateManager.frigateRtspPort = 8554;
    const status = frigateManager.status();
    expect(status).to.deep.equal({
      mode: 'local',
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
      openvinoCapable: true,
      renderDevicePath: '/dev/dri/renderD128',
      coralAvailable: true,
      coralDeviceType: 'usb',
      detector: 'coral',
      configPendingRestart: true,
      remoteConnectionError: null,
      mqttPort: 1885,
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
    });
  });
});
