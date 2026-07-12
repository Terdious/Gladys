const logger = require('../../../utils/logger');
const { CONFIGURATION } = require('./constants');

/**
 * @description Save Frigate configuration.
 * @param {object} config - Frigate service configuration.
 * @returns {Promise} Resolve when configuration is stored.
 * @example
 * await frigate.saveConfiguration(config);
 */
async function saveConfiguration(config) {
  logger.debug('Frigate: storing configuration...');

  const keyValueMap = {
    [CONFIGURATION.GLADYS_MQTT_USERNAME_KEY]: config.mqttUsername,
    [CONFIGURATION.GLADYS_MQTT_PASSWORD_KEY]: config.mqttPassword,
    [CONFIGURATION.FRIGATE_MQTT_USERNAME_KEY]: config.frigateMqttUsername,
    [CONFIGURATION.FRIGATE_MQTT_PASSWORD_KEY]: config.frigateMqttPassword,
    [CONFIGURATION.MQTT_PORT_KEY]: config.mqttPort,
    [CONFIGURATION.UI_PORT_KEY]: config.frigateUiPort,
    [CONFIGURATION.API_PORT_KEY]: config.frigateApiPort,
    [CONFIGURATION.RTSP_PORT_KEY]: config.frigateRtspPort,
    [CONFIGURATION.DOCKER_MQTT_VERSION]: config.dockerMqttVersion,
    [CONFIGURATION.DOCKER_FRIGATE_VERSION]: config.dockerFrigateVersion,
  };

  const variableKeys = Object.keys(keyValueMap);

  await Promise.all(variableKeys.map((key) => this.saveOrDestroyVariable(key, keyValueMap[key])));

  logger.debug('Frigate: configuration stored');
}

module.exports = {
  saveConfiguration,
};
