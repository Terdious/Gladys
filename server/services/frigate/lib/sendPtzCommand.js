const logger = require('../../../utils/logger');
const { NotFoundError, ServiceNotConfiguredError, BadParameters } = require('../../../utils/coreErrors');
const { DEVICE_EXTERNAL_ID_PREFIX, PTZ_COMMAND_REGEX, CAMERA_PARAMS, CONTROL_PROTOCOLS } = require('./constants');
const { getDeviceParam } = require('./buildCameraConfig');

/**
 * @description Send a PTZ command to a camera. Cameras with an ONVIF endpoint
 * are driven through the Frigate MQTT topic; cameras declared with a
 * proprietary control protocol by the catalog (D-Link HTTP) are driven
 * directly.
 * @param {string} cameraSelector - The camera to control.
 * @param {string} command - PTZ command (MOVE_UP/DOWN/LEFT/RIGHT, ZOOM_IN/OUT, STOP, preset_<name>).
 * @returns {Promise} Resolve when the command is sent.
 * @example
 * await sendPtzCommand('my-camera', 'MOVE_LEFT');
 */
async function sendPtzCommand(cameraSelector, command) {
  if (!PTZ_COMMAND_REGEX.test(command)) {
    throw new BadParameters(`Frigate: invalid PTZ command "${command}"`);
  }
  const device = await this.gladys.device.getBySelector(cameraSelector);
  const [externalIdPrefix, cameraName] = (device.external_id || '').split(':');
  if (externalIdPrefix !== DEVICE_EXTERNAL_ID_PREFIX || !cameraName) {
    throw new NotFoundError('CAMERA_NOT_MANAGED_BY_FRIGATE');
  }
  if (getDeviceParam(device, CAMERA_PARAMS.PTZ_PROTOCOL) === CONTROL_PROTOCOLS.DLINK_HTTP) {
    return this.sendDlinkPtzCommand(device, command);
  }
  if (!this.mqttClient || !this.gladysConnected) {
    throw new ServiceNotConfiguredError('FRIGATE_MQTT_NOT_CONNECTED');
  }
  logger.debug(`Frigate: sending PTZ command ${command} to camera ${cameraName}`);
  this.mqttClient.publish(`frigate/${cameraName}/ptz`, command);
  return null;
}

module.exports = {
  sendPtzCommand,
};
