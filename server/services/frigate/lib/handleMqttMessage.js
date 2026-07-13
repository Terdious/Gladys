const logger = require('../../../utils/logger');
const { EVENTS } = require('../../../utils/constants');
const { MQTT_TOPICS, DEVICE_EXTERNAL_ID_PREFIX } = require('./constants');

/**
 * @description Handle a new message receive in MQTT.
 * @param {string} topic - MQTT topic.
 * @param {Buffer|string} message - The message sent (raw buffer: snapshots are binary).
 * @returns {Promise} Resolve when the message is handled.
 * @example
 * await handleMqttMessage('frigate/available', 'online');
 */
async function handleMqttMessage(topic, message) {
  // Snapshots are binary JPEG payloads: never converted to a string
  const isBinarySnapshot = topic.endsWith('/snapshot');
  const messageString = isBinarySnapshot ? null : message.toString();
  this.recordMqttMessage(topic, isBinarySnapshot ? message : messageString);
  switch (topic) {
    case MQTT_TOPICS.AVAILABLE: {
      this.frigateConnected = messageString === 'online';
      logger.info(`Frigate is ${messageString}`);
      this.emitStatusEvent();
      if (this.frigateConnected) {
        // Frigate API is up at this point
        await this.configureAdminUser();
      }
      break;
    }
    case MQTT_TOPICS.STATS: {
      try {
        this.stats = JSON.parse(messageString);
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
      // frigate/<camera>/<label>/snapshot => JPEG of the last detection of this label
      if (isBinarySnapshot && topicParts.length === 4) {
        const [, cameraName, label] = topicParts;
        await this.updateLabelImage(cameraName, label, message);
        break;
      }
      // frigate/<camera>/<label> => number of detected objects
      if (topicParts.length === 3) {
        const [, cameraName, label] = topicParts;
        const featureExternalId = `${DEVICE_EXTERNAL_ID_PREFIX}:${cameraName}:${label}`;
        const feature = this.gladys.stateManager.get('deviceFeatureByExternalId', featureExternalId);
        const count = parseInt(messageString, 10);
        if (feature && !Number.isNaN(count)) {
          // The payload is an object count: normalize to a binary detection state
          const state = count > 0 ? 1 : 0;
          logger.info(`Frigate: camera ${cameraName}, ${label} detection = ${state} (${count} object(s))`);
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
