const logger = require('../../../utils/logger');
const { MQTT_TOPICS } = require('./constants');

/**
 * @description Handle a new message receive in MQTT.
 * @param {string} topic - MQTT topic.
 * @param {string} message - The message sent.
 * @returns {null} Null.
 * @example
 * handleMqttMessage('frigate/available', 'online');
 */
function handleMqttMessage(topic, message) {
  switch (topic) {
    case MQTT_TOPICS.AVAILABLE: {
      this.frigateConnected = message === 'online';
      logger.info(`Frigate is ${message}`);
      this.emitStatusEvent();
      break;
    }
    case MQTT_TOPICS.STATS: {
      try {
        this.stats = JSON.parse(message);
      } catch (e) {
        logger.warn(`Frigate: unable to parse stats message - ${e}`);
      }
      break;
    }
    default: {
      logger.debug(`Frigate: MQTT topic ${topic} not handled`);
      break;
    }
  }

  return null;
}

module.exports = {
  handleMqttMessage,
};
