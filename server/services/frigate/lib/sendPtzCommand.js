const logger = require('../../../utils/logger');
const { NotFoundError, ServiceNotConfiguredError, BadParameters } = require('../../../utils/coreErrors');
const { DEVICE_EXTERNAL_ID_PREFIX, PTZ_COMMAND_REGEX } = require('./constants');

/**
 * @description Send a PTZ command to a camera through the Frigate MQTT topic.
 * Frigate drives the camera over ONVIF (the camera must have an onvif section,
 * generated when the ONVIF credentials are set on the device).
 * @param {string} cameraSelector - The camera to control.
 * @param {string} command - PTZ command (MOVE_UP/DOWN/LEFT/RIGHT, ZOOM_IN/OUT, STOP, preset_<name>).
 * @returns {Promise} Resolve when the command is published.
 * @example
 * await sendPtzCommand('my-camera', 'MOVE_LEFT');
 */
async function sendPtzCommand(cameraSelector, command) {
  if (!PTZ_COMMAND_REGEX.test(command)) {
    throw new BadParameters(`Frigate: invalid PTZ command "${command}"`);
  }
  if (!this.mqttClient || !this.gladysConnected) {
    throw new ServiceNotConfiguredError('FRIGATE_MQTT_NOT_CONNECTED');
  }
  const device = await this.gladys.device.getBySelector(cameraSelector);
  const [externalIdPrefix, cameraName] = (device.external_id || '').split(':');
  if (externalIdPrefix !== DEVICE_EXTERNAL_ID_PREFIX || !cameraName) {
    throw new NotFoundError('CAMERA_NOT_MANAGED_BY_FRIGATE');
  }
  logger.debug(`Frigate: sending PTZ command ${command} to camera ${cameraName}`);
  this.mqttClient.publish(`frigate/${cameraName}/ptz`, command);
  return null;
}

module.exports = {
  sendPtzCommand,
};
