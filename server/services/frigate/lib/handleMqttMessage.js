const logger = require('../../../utils/logger');
const { EVENTS } = require('../../../utils/constants');
const { MQTT_TOPICS, DEVICE_EXTERNAL_ID_PREFIX } = require('./constants');

/**
 * @description Handle a new message receive in MQTT.
 * @param {string} topic - MQTT topic.
 * @param {string} message - The message sent.
 * @returns {Promise} Resolve when the message is handled.
 * @example
 * await handleMqttMessage('frigate/available', 'online');
 */
async function handleMqttMessage(topic, message) {
  switch (topic) {
    case MQTT_TOPICS.AVAILABLE: {
      this.frigateConnected = message === 'online';
      logger.info(`Frigate is ${message}`);
      this.emitStatusEvent();
      if (this.frigateConnected) {
        // Frigate API is up at this point
        await this.configureAdminUser();
      }
      break;
    }
    case MQTT_TOPICS.STATS: {
      try {
        this.stats = JSON.parse(message);
      } catch (e) {
        logger.warn(`Frigate: unable to parse stats message - ${e}`);
      }
      // Periodic backstop: retry until the admin user is configured
      if (!this.adminConfigured) {
        await this.configureAdminUser();
      }
      break;
    }
    default: {
      const topicParts = topic.split('/');
      // frigate/<camera>/<label> => 1/0 detection state
      if (topicParts.length === 3) {
        const [, cameraName, label] = topicParts;
        const featureExternalId = `${DEVICE_EXTERNAL_ID_PREFIX}:${cameraName}:${label}`;
        const feature = this.gladys.stateManager.get('deviceFeatureByExternalId', featureExternalId);
        const state = parseInt(message, 10);
        if (feature && !Number.isNaN(state)) {
          this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
            device_feature_external_id: featureExternalId,
            state,
          });
          if (state === 1) {
            // Push a fresh snapshot to the dashboard when a detection starts
            await this.updateCameraImage(cameraName);
          }
          break;
        }
      }
      logger.debug(`Frigate: MQTT topic ${topic} not handled`);
      break;
    }
  }

  return null;
}

module.exports = {
  handleMqttMessage,
};
