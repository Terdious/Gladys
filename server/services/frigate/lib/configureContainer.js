const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const yaml = require('yaml');

const logger = require('../../../utils/logger');
const { DEFAULT } = require('./constants');

const YAML_CONFIG = { singleQuote: true };

/**
 * @description Configure Frigate container.
 * @param {string} basePathOnContainer - Gladys base path.
 * @param {object} config - Gladys Frigate stored configuration.
 * @returns {Promise} Indicates if the configuration file has been created or modified.
 * @example
 * await this.configureContainer('/var/lib/gladysassistant', {});
 */
async function configureContainer(basePathOnContainer, config) {
  logger.info('Frigate Docker container is being configured...');

  // Create configuration path (if not exists)
  const configFilepath = path.join(basePathOnContainer, DEFAULT.CONFIGURATION_PATH);
  await fs.mkdir(path.dirname(configFilepath), {
    recursive: true,
  });

  // Check if config file not already exists
  let configCreated = false;
  try {
    // eslint-disable-next-line no-bitwise
    await fs.access(configFilepath, constants.R_OK | constants.W_OK);
    logger.info('Frigate configuration file already exists.');
  } catch (e) {
    logger.info('Writing default Frigate configuration...');
    await fs.writeFile(configFilepath, yaml.stringify(DEFAULT.CONFIGURATION_CONTENT));
    configCreated = true;
  }

  // Check for changes
  const fileContent = await fs.readFile(configFilepath);
  const loadedConfig = yaml.parse(fileContent.toString());
  const { mqtt = {} } = loadedConfig;

  let configChanged = false;
  if (
    mqtt.enabled !== true ||
    mqtt.host !== DEFAULT.MQTT_HOST_FROM_CONTAINER ||
    mqtt.port !== config.mqttPort ||
    mqtt.user !== config.frigateMqttUsername ||
    mqtt.password !== config.frigateMqttPassword
  ) {
    mqtt.enabled = true;
    mqtt.host = DEFAULT.MQTT_HOST_FROM_CONTAINER;
    mqtt.port = config.mqttPort;
    mqtt.user = config.frigateMqttUsername;
    mqtt.password = config.frigateMqttPassword;
    loadedConfig.mqtt = mqtt;
    configChanged = true;
  }

  // Frigate refuses to start without a cameras section
  if (!loadedConfig.cameras) {
    loadedConfig.cameras = {};
    configChanged = true;
  }

  if (configChanged) {
    logger.info('Writing custom Frigate configuration file...');
    await fs.writeFile(configFilepath, yaml.stringify(loadedConfig, YAML_CONFIG));
  }

  return { configChanged: configCreated || configChanged };
}

module.exports = {
  configureContainer,
};
