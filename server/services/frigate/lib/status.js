/**
 * @description Get Frigate service status.
 * @returns {object} Current Frigate containers and configuration status.
 * @example
 * status();
 */
function status() {
  const frigateStatus = {
    dockerBased: this.dockerBased,
    networkModeValid: this.networkModeValid,
    frigateEnabled: this.frigateEnabled,
    mqttExist: this.mqttExist,
    mqttRunning: this.mqttRunning,
    frigateExist: this.frigateExist,
    frigateRunning: this.frigateRunning,
    gladysConnected: this.gladysConnected,
    frigateConnected: this.frigateConnected,
    vaapiAvailable: this.vaapiAvailable,
    openvinoCapable: this.openvinoCapable,
    renderDevicePath: this.renderDevicePath,
    coralAvailable: this.coralAvailable,
    coralDeviceType: this.coralDeviceType,
    detector: this.detector,
    configPendingRestart: this.configPendingRestart,
    mqttPort: this.mqttPort,
    frigateUiPort: this.frigateUiPort,
    frigateApiPort: this.frigateApiPort,
    frigateRtspPort: this.frigateRtspPort,
  };
  return frigateStatus;
}

module.exports = {
  status,
};
