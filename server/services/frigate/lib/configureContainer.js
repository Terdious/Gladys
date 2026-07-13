const fs = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const yaml = require('yaml');

const logger = require('../../../utils/logger');
const { DEFAULT } = require('./constants');
const { buildCameraConfig } = require('./buildCameraConfig');

const YAML_CONFIG = { singleQuote: true };

/**
 * @description Configure Frigate container. Gladys owns the mqtt, go2rtc and
 * cameras sections of the config file; any other section added manually
 * (detectors, hardware acceleration...) is left untouched. The file is only
 * rewritten when the generated content actually differs, so the caller only
 * restarts Frigate when needed.
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
  } catch (e) {
    logger.info('Writing default Frigate configuration...');
    await fs.writeFile(configFilepath, yaml.stringify(DEFAULT.CONFIGURATION_CONTENT, YAML_CONFIG));
    configCreated = true;
  }

  const fileContent = (await fs.readFile(configFilepath)).toString();
  const loadedConfig = yaml.parse(fileContent) || {};

  const mqtt = loadedConfig.mqtt || {};
  mqtt.enabled = true;
  mqtt.host = DEFAULT.MQTT_HOST_FROM_CONTAINER;
  mqtt.port = config.mqttPort;
  mqtt.user = config.frigateMqttUsername;
  mqtt.password = config.frigateMqttPassword;
  loadedConfig.mqtt = mqtt;

  // Build go2rtc streams and cameras sections from Gladys devices
  // (the Gladys DB is the source of truth for these two sections).
  // Within a camera, Gladys only owns ffmpeg/detect/objects.track/record/
  // snapshots: everything configured through the Frigate UI (zones, motion
  // masks, object filters, audio...) is preserved.
  const devices = await this.gladys.device.get({ service: 'frigate' });
  const existingCameras = loadedConfig.cameras || {};
  const go2rtcStreams = {};
  const cameras = {};
  devices.forEach((device) => {
    try {
      const { cameraName, go2rtcSource, go2rtcSubSource, cameraSection } = buildCameraConfig(device);
      go2rtcStreams[cameraName] = [go2rtcSource];
      if (go2rtcSubSource) {
        go2rtcStreams[`${cameraName}_sub`] = [go2rtcSubSource];
      }
      const existingCamera = existingCameras[cameraName] || {};
      cameras[cameraName] = {
        ...existingCamera,
        ...cameraSection,
        objects: {
          ...existingCamera.objects,
          ...cameraSection.objects,
        },
      };
    } catch (e) {
      logger.warn(`Frigate: skipping camera ${device.external_id} - ${e}`);
    }
  });

  if (Object.keys(go2rtcStreams).length > 0) {
    loadedConfig.go2rtc = { streams: go2rtcStreams };
  } else {
    delete loadedConfig.go2rtc;
  }
  // Frigate refuses to start without a cameras section
  loadedConfig.cameras = cameras;

  const newContent = yaml.stringify(loadedConfig, YAML_CONFIG);
  const configChanged = newContent !== fileContent;
  if (configChanged) {
    logger.info('Writing custom Frigate configuration file...');
    await fs.writeFile(configFilepath, newContent);
  }

  return { configChanged: configCreated || configChanged };
}

module.exports = {
  configureContainer,
};
