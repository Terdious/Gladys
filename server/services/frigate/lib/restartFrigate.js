const logger = require('../../../utils/logger');
const { MQTT_TOPICS } = require('./constants');

/**
 * @description Reload Frigate so it picks up the pending configuration file.
 * When Frigate is reachable, its frigate/restart MQTT topic triggers a fast
 * process-level restart; otherwise the full init path (re)starts containers.
 * @returns {Promise} Resolve when the restart has been requested.
 * @example
 * await frigate.restartFrigate();
 */
async function restartFrigate() {
  if (this.mqttClient && this.frigateConnected) {
    logger.info('Frigate: requesting process restart through MQTT');
    this.mqttClient.publish(MQTT_TOPICS.RESTART, 'restart');
  } else {
    logger.info('Frigate: not reachable through MQTT, running full init to restart it');
    await this.init();
  }
  this.configPendingRestart = false;
  this.emitStatusEvent();
}

module.exports = {
  restartFrigate,
};
