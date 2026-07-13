const axios = require('axios');

const logger = require('../../../utils/logger');
const { BadParameters, NotFoundError, ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { CAMERA_PARAMS, CONTROL_PROTOCOLS, DEFAULT } = require('./constants');
const { getDeviceParam } = require('./buildCameraConfig');

/**
 * @description Control a Frigate camera feature. Currently supports the night
 * mode switch of D-Link cameras: ON forces the infrared night mode, OFF goes
 * back to the automatic day/night mode.
 * @param {object} device - The device to control.
 * @param {object} deviceFeature - The feature to control.
 * @param {string|number} value - The new value.
 * @returns {Promise} Resolve when the command is sent.
 * @example
 * await setValue(device, deviceFeature, 1);
 */
async function setValue(device, deviceFeature, value) {
  const externalId = deviceFeature.external_id || '';
  if (!externalId.endsWith(':nightmode')) {
    throw new NotFoundError(`Frigate: feature ${externalId} is not controllable`);
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
