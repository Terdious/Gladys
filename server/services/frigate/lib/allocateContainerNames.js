const logger = require('../../../utils/logger');
const { generate } = require('../../../utils/password');
const { DEFAULT } = require('./constants');

/**
 * @description Resolve a container name we can safely own. The container of a
 * previous install is adopted only when its image proves it is ours: a user
 * container that happens to use the same name must never be touched (it
 * would be removed by the update flow).
 * @param {string} baseName - Preferred container name.
 * @param {string} legacyName - Name used by previous versions of the service.
 * @param {string} imageMarker - Substring identifying our image.
 * @returns {Promise<string>} Resolve with a free (or adopted) container name.
 * @example
 * await resolveContainerName.call(this, 'gladys-frigate-server', 'gladys-frigate', 'blakeblackshear/frigate');
 */
async function resolveContainerName(baseName, legacyName, imageMarker) {
  const legacyContainers = await this.getDockerContainer(legacyName);
  if (legacyContainers.length > 0 && (legacyContainers[0].Image || '').includes(imageMarker)) {
    return legacyName;
  }
  let candidate = baseName;
  // eslint-disable-next-line no-plusplus
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await this.getDockerContainer(candidate);
    if (existing.length === 0) {
      return candidate;
    }
    logger.info(`Frigate: container name ${candidate} is already used by another container`);
    candidate = `${baseName}-${generate(7, { number: true, lowercase: true })}`;
  }
  throw new Error(`Frigate: unable to find a free container name from ${baseName}`);
}

/**
 * @description Allocate the names of the containers owned by the service,
 * following the same resolve-once-then-persist pattern as the ports: the
 * resolved names are stored in the configuration (persisted as variables) so
 * the service always finds its own containers back.
 * @param {object} config - Service configuration properties.
 * @returns {Promise} Resolve when the names are allocated.
 * @example
 * await frigate.allocateContainerNames(config);
 */
async function allocateContainerNames(config) {
  if (!config.mqttContainerName) {
    config.mqttContainerName = await resolveContainerName.call(
      this,
      DEFAULT.MQTT_CONTAINER_BASE_NAME,
      DEFAULT.MQTT_CONTAINER_BASE_NAME,
      'mosquitto',
    );
    logger.info(`Frigate: allocated container name ${config.mqttContainerName} for the MQTT broker`);
  }
  if (!config.containerName) {
    config.containerName = await resolveContainerName.call(
      this,
      DEFAULT.CONTAINER_BASE_NAME,
      DEFAULT.LEGACY_CONTAINER_NAME,
      'blakeblackshear/frigate',
    );
    logger.info(`Frigate: allocated container name ${config.containerName} for Frigate`);
  }
}

module.exports = {
  allocateContainerNames,
};
