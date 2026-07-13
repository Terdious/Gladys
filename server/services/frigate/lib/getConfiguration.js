const { SYSTEM_VARIABLE_NAMES } = require('../../../utils/constants');
const logger = require('../../../utils/logger');
const { CONFIGURATION } = require('./constants');

/**
 * @description Get Frigate configuration.
 * @returns {Promise} Current Frigate service configuration.
 * @example
 * const config = await frigate.getConfiguration();
 */
async function getConfiguration() {
  logger.debug('Frigate: loading stored configuration...');

  const frigateEnabledValue = await this.gladys.variable.getValue(CONFIGURATION.FRIGATE_ENABLED, this.serviceId);
  const frigateEnabled = frigateEnabledValue === '1';

  // Load MQTT parameters
  const mqttUsername = await this.gladys.variable.getValue(CONFIGURATION.GLADYS_MQTT_USERNAME_KEY, this.serviceId);
  const mqttPassword = await this.gladys.variable.getValue(CONFIGURATION.GLADYS_MQTT_PASSWORD_KEY, this.serviceId);
  const frigateMqttUsername = await this.gladys.variable.getValue(
    CONFIGURATION.FRIGATE_MQTT_USERNAME_KEY,
    this.serviceId,
  );
  const frigateMqttPassword = await this.gladys.variable.getValue(
    CONFIGURATION.FRIGATE_MQTT_PASSWORD_KEY,
    this.serviceId,
  );

  // Load allocated ports
  const mqttPort = await this.gladys.variable.getValue(CONFIGURATION.MQTT_PORT_KEY, this.serviceId);
  const frigateUiPort = await this.gladys.variable.getValue(CONFIGURATION.UI_PORT_KEY, this.serviceId);
  const frigateApiPort = await this.gladys.variable.getValue(CONFIGURATION.API_PORT_KEY, this.serviceId);
  const frigateRtspPort = await this.gladys.variable.getValue(CONFIGURATION.RTSP_PORT_KEY, this.serviceId);

  // Load version parameters
  const dockerMqttVersion = await this.gladys.variable.getValue(CONFIGURATION.DOCKER_MQTT_VERSION, this.serviceId);
  const dockerFrigateVersion = await this.gladys.variable.getValue(
    CONFIGURATION.DOCKER_FRIGATE_VERSION,
    this.serviceId,
  );

  // Load recording retention settings (in days)
  const recordContinuousDays = await this.gladys.variable.getValue(
    CONFIGURATION.RECORD_CONTINUOUS_DAYS_KEY,
    this.serviceId,
  );
  const recordAlertsDays = await this.gladys.variable.getValue(CONFIGURATION.RECORD_ALERTS_DAYS_KEY, this.serviceId);
  const recordDetectionsDays = await this.gladys.variable.getValue(
    CONFIGURATION.RECORD_DETECTIONS_DAYS_KEY,
    this.serviceId,
  );

  // Gladys params
  const timezone = await this.gladys.variable.getValue(SYSTEM_VARIABLE_NAMES.TIMEZONE);

  return {
    frigateEnabled,
    mqttUsername,
    mqttPassword,
    frigateMqttUsername,
    frigateMqttPassword,
    mqttPort,
    frigateUiPort,
    frigateApiPort,
    frigateRtspPort,
    dockerMqttVersion,
    dockerFrigateVersion,
    recordContinuousDays,
    recordAlertsDays,
    recordDetectionsDays,
    timezone,
  };
}

module.exports = {
  getConfiguration,
};
