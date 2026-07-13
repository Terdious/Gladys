const axios = require('axios');

const logger = require('../../../utils/logger');
const { BadParameters, NotFoundError, ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { DEVICE_FEATURE_TYPES } = require('../../../utils/constants');
const { CAMERA_PARAMS, CONTROL_PROTOCOLS, DEFAULT } = require('./constants');
const { getDeviceParam } = require('./buildCameraConfig');

// PTZ features carry a -1/0/+1 direction per axis (0 = stop)
const PTZ_COMMANDS_BY_TYPE = {
  [DEVICE_FEATURE_TYPES.CAMERA.PAN]: { '-1': 'MOVE_LEFT', 1: 'MOVE_RIGHT' },
  [DEVICE_FEATURE_TYPES.CAMERA.TILT]: { '-1': 'MOVE_DOWN', 1: 'MOVE_UP' },
  [DEVICE_FEATURE_TYPES.CAMERA.ZOOM]: { '-1': 'ZOOM_OUT', 1: 'ZOOM_IN' },
};

/**
 * @description Control a Frigate camera feature: PTZ axes (routed to the
 * D-Link HTTP driver or to the Frigate ONVIF MQTT topic) and the night mode
 * of D-Link cameras (on = infrared forced, off = automatic).
 * @param {object} device - The device to control.
 * @param {object} deviceFeature - The feature to control.
 * @param {string|number} value - The new value.
 * @returns {Promise} Resolve when the command is sent.
 * @example
 * await setValue(device, deviceFeature, 1);
 */
async function setValue(device, deviceFeature, value) {
  const ptzCommands = PTZ_COMMANDS_BY_TYPE[deviceFeature.type];
  if (ptzCommands) {
    const direction = Number(value);
    if (getDeviceParam(device, CAMERA_PARAMS.PTZ_PROTOCOL) === CONTROL_PROTOCOLS.DLINK_HTTP) {
      if (direction === 0) {
        // D-Link moves are single steps: there is nothing to stop
        return null;
      }
      const command = ptzCommands[direction];
      if (!command) {
        throw new BadParameters(`Frigate: invalid PTZ value "${value}"`);
      }
      return this.sendDlinkPtzCommand(device, command);
    }
    const command = direction === 0 ? 'STOP' : ptzCommands[direction];
    if (!command) {
      throw new BadParameters(`Frigate: invalid PTZ value "${value}"`);
    }
    return this.sendPtzCommand(device.selector, command);
  }

  if (deviceFeature.type !== DEVICE_FEATURE_TYPES.CAMERA.NIGHT_MODE) {
    throw new NotFoundError(`Frigate: feature ${deviceFeature.external_id} is not controllable`);
  }
  const nightModeProtocol = getDeviceParam(device, CAMERA_PARAMS.NIGHT_MODE_PROTOCOL);
  if (nightModeProtocol !== CONTROL_PROTOCOLS.DLINK_HTTP) {
    throw new BadParameters(`Frigate: night mode of camera ${device.external_id} is not controllable`);
  }
  const host = getDeviceParam(device, CAMERA_PARAMS.SOURCE_HOST);
  const username = getDeviceParam(device, CAMERA_PARAMS.ONVIF_USERNAME);
  const password = getDeviceParam(device, CAMERA_PARAMS.ONVIF_PASSWORD);
  if (!host || !username || !password) {
    throw new ServiceNotConfiguredError('FRIGATE_CAMERA_CONTROL_CREDENTIALS_MISSING');
  }
  const port = Number(getDeviceParam(device, CAMERA_PARAMS.SOURCE_HTTP_PORT)) || DEFAULT.HTTP_PORT;
  const mode = value ? DEFAULT.DLINK_NIGHT_MODE_ON : DEFAULT.DLINK_NIGHT_MODE_AUTO;
  logger.debug(`Frigate: setting D-Link night mode ${mode} on camera ${host}`);
  await axios.get(`http://${host}:${port}${DEFAULT.DLINK_DAYNIGHT_PATH}?DayNightMode=${mode}&ConfigReboot=no`, {
    auth: { username, password },
  });
  return null;
}

module.exports = {
  setValue,
};
