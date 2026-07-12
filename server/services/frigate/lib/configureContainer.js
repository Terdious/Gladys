const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const yaml = require('yaml');

const logger = require('../../../utils/logger');
const { DEFAULT } = require('./constants');
const { buildCameraConfig } = require('./buildCameraConfig');

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

  // Build go2rtc streams and cameras sections from Gladys devices
  // (the Gladys DB is the source of truth for these two sections)
  const devices = await this.gladys.device.get({ service: 'frigate' });
  const go2rtcStreams = {};
  const cameras = {};
  devices.forEach((device) => {
    try {
      const { cameraName, go2rtcSource, cameraSection } = buildCameraConfig(device);
      go2rtcStreams[cameraName] = [go2rtcSource];
      cameras[cameraName] = cameraSection;
    } catch (e) {
      logger.warn(`Frigate: skipping camera ${device.external_id} - ${e}`);
    }
  });

  if (Object.keys(go2rtcStreams).length > 0) {
    const newGo2rtc = { streams: go2rtcStreams };
    if (JSON.stringify(loadedConfig.go2rtc) !== JSON.stringify(newGo2rtc)) {
      loadedConfig.go2rtc = newGo2rtc;
      configChanged = true;
    }
  } else if (loadedConfig.go2rtc) {
    delete loadedConfig.go2rtc;
    configChanged = true;
  }

  // Frigate refuses to start without a cameras section
  if (JSON.stringify(loadedConfig.cameras) !== JSON.stringify(cameras)) {
    loadedConfig.cameras = cameras;
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
