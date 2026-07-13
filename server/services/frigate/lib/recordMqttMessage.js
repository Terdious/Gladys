const { DEFAULT } = require('./constants');

/**
 * @description Record an incoming MQTT message in the in-memory debug ring
 * buffer displayed on the MQTT debug page. Binary snapshots are replaced by a
 * marker and long payloads are truncated.
 * @param {string} topic - MQTT topic.
 * @param {string} message - The message received.
 * @example
 * recordMqttMessage('frigate/available', 'online');
 */
function recordMqttMessage(topic, message) {
  let payload = message;
  if (topic.endsWith('/snapshot')) {
    payload = `[binary snapshot, ${message.length} bytes]`;
  } else if (payload.length > DEFAULT.MQTT_DEBUG_PAYLOAD_MAX_LENGTH) {
    payload = `${payload.substring(0, DEFAULT.MQTT_DEBUG_PAYLOAD_MAX_LENGTH)}… [truncated, ${
      message.length
    } characters]`;
  }
  this.mqttDebugMessages.unshift({
    topic,
    payload,
    received_at: new Date().toISOString(),
  });
  if (this.mqttDebugMessages.length > DEFAULT.MQTT_DEBUG_BUFFER_SIZE) {
    this.mqttDebugMessages.pop();
  }
}

module.exports = {
  recordMqttMessage,
};
