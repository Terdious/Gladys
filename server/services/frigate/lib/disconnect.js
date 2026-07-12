const logger = require('../../../utils/logger');

const mqttContainerDescriptor = require('../docker/gladys-frigate-mqtt-container.json');
const frigateContainerDescriptor = require('../docker/gladys-frigate-container.json');

/**
 * @description Disconnect service from dependent containers.
 * @example
 * disconnect();
 */
async function disconnect() {
  let container;

  // Disconnect from MQTT broker
  if (this.mqttClient) {
    logger.debug(`Disconnecting existing MQTT client...`);
    this.mqttClient.end();
    this.mqttClient.removeAllListeners();
    this.mqttClient = null;
  } else {
    logger.debug('Not connected');
  }
  this.gladysConnected = false;
  this.emitStatusEvent();

  // Stop & remove MQTT container
  let dockerContainer = await this.gladys.system.getContainers({
    all: true,
    filters: { name: [mqttContainerDescriptor.name] },
  });
  if (dockerContainer.length > 0) {
    [container] = dockerContainer;
    await this.gladys.system.stopContainer(container.id);
    await this.gladys.system.removeContainer(container.id);
  }
  this.mqttRunning = false;
  this.emitStatusEvent();

  // Stop & remove Frigate container
  dockerContainer = await this.gladys.system.getContainers({
    all: true,
    filters: { name: [frigateContainerDescriptor.name] },
  });
  if (dockerContainer.length > 0) {
    [container] = dockerContainer;
    await this.gladys.system.stopContainer(container.id);
    await this.gladys.system.removeContainer(container.id);
  }
  this.frigateRunning = false;
  this.frigateConnected = false;
  this.stats = null;
  this.emitStatusEvent();
}

module.exports = {
  disconnect,
};
