const logger = require('../../../utils/logger');
const { DEFAULT } = require('./constants');

const mqttContainerDescriptor = require('../docker/gladys-frigate-mqtt-container.json');
const frigateContainerDescriptor = require('../docker/gladys-frigate-container.json');

/**
 * @description Checks if version is the latest for this service, if not, it removes existing containers.
 * @param {object} config - Service configuration properties.
 * @example
 * await frigate.checkForContainerUpdates(config);
 */
async function checkForContainerUpdates(config) {
  logger.info('Checking for current installed versions and required updates...');

  // Check for MQTT container version
  if (config.dockerMqttVersion !== DEFAULT.DOCKER_MQTT_VERSION) {
    logger.info(`Frigate MQTT container: update #${DEFAULT.DOCKER_MQTT_VERSION} of the container required...`);

    const containers = await this.gladys.system.getContainers({
      all: true,
      filters: { name: [mqttContainerDescriptor.name] },
    });

    if (containers.length !== 0) {
      logger.debug('Removing current installed Frigate MQTT container...');
      // If container is present, we remove it
      // The init process will create it again
      const [container] = containers;
      await this.gladys.system.removeContainer(container.id, { force: true });
    }

    // Update to last version
    config.dockerMqttVersion = DEFAULT.DOCKER_MQTT_VERSION;
    logger.info(`Frigate MQTT container: update #${DEFAULT.DOCKER_MQTT_VERSION} of the container done`);
  }

  // Check for Frigate container version
  if (config.dockerFrigateVersion !== DEFAULT.DOCKER_FRIGATE_VERSION) {
    logger.info(`Frigate container: update #${DEFAULT.DOCKER_FRIGATE_VERSION} of the container required...`);

    const containers = await this.gladys.system.getContainers({
      all: true,
      filters: { name: [frigateContainerDescriptor.name] },
    });

    if (containers.length !== 0) {
      logger.debug('Removing current installed Frigate container...');
      // If container is present, we remove it
      // The init process will create it again
      const [container] = containers;
      await this.gladys.system.removeContainer(container.id, { force: true });
    }

    // Update to last version
    config.dockerFrigateVersion = DEFAULT.DOCKER_FRIGATE_VERSION;
    logger.info(`Frigate container: update #${DEFAULT.DOCKER_FRIGATE_VERSION} of the container done`);
  }
}

module.exports = {
  checkForContainerUpdates,
};
