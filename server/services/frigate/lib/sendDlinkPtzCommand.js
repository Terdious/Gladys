const axios = require('axios');

const logger = require('../../../utils/logger');
const { BadParameters, ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { CAMERA_PARAMS, DEFAULT } = require('./constants');
const { getDeviceParam } = require('./buildCameraConfig');

/**
 * @description Send a PTZ command to a D-Link camera through its proprietary
 * HTTP CGI (single-step moves). Requires the camera admin account in the
 * control credentials. Validated on the DCS-5020L (firmware 1.16).
 * @param {object} device - The camera device.
 * @param {string} command - PTZ command (MOVE_UP/DOWN/LEFT/RIGHT, STOP).
 * @returns {Promise} Resolve when the command is sent.
 * @example
 * await sendDlinkPtzCommand(device, 'MOVE_LEFT');
 */
async function sendDlinkPtzCommand(device, command) {
  // Moves are single steps: there is nothing to stop
  if (command === 'STOP') {
    return null;
  }
  const move = DEFAULT.DLINK_PTZ_MOVES[command];
  if (move === undefined) {
    throw new BadParameters(`Frigate: PTZ command "${command}" is not supported by this camera`);
  }
  const host = getDeviceParam(device, CAMERA_PARAMS.SOURCE_HOST);
  const username = getDeviceParam(device, CAMERA_PARAMS.ONVIF_USERNAME);
  const password = getDeviceParam(device, CAMERA_PARAMS.ONVIF_PASSWORD);
  if (!host || !username || !password) {
    throw new ServiceNotConfiguredError('FRIGATE_CAMERA_CONTROL_CREDENTIALS_MISSING');
  }
  const port = Number(getDeviceParam(device, CAMERA_PARAMS.SOURCE_HTTP_PORT)) || DEFAULT.HTTP_PORT;
  const body = new URLSearchParams({
    PanSingleMoveDegree: `${DEFAULT.DLINK_PTZ_STEP_DEGREES}`,
    TiltSingleMoveDegree: `${DEFAULT.DLINK_PTZ_STEP_DEGREES}`,
    PanTiltSingleMove: `${move}`,
  }).toString();
  logger.debug(`Frigate: sending D-Link PTZ move ${command} to camera ${host}`);
  await axios.post(`http://${host}:${port}${DEFAULT.DLINK_PANTILT_PATH}`, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    auth: { username, password },
  });
  return null;
}

module.exports = {
  sendDlinkPtzCommand,
};
