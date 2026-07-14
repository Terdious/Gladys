const logger = require('../../../utils/logger');
const { MODES } = require('./constants');

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
  this.frigateConnected = false;
  this.emitStatusEvent();

  // Remote mode: nothing else to clean, the containers belong to the
  // installation running on the other machine
  if (this.mode === MODES.REMOTE) {
    return;
  }

  // Stop & remove MQTT container
  let dockerContainer = await this.getDockerContainer(mqttContainerDescriptor.name);
  if (dockerContainer.length > 0) {
    [container] = dockerContainer;
    await this.gladys.system.stopContainer(container.id);
    await this.gladys.system.removeContainer(container.id);
  }
  this.mqttRunning = false;
  this.emitStatusEvent();

  // Stop & remove Frigate container
  dockerContainer = await this.getDockerContainer(frigateContainerDescriptor.name);
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
