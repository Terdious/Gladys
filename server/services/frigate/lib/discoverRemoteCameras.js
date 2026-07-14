const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { MODES, TRACKABLE_LABELS, DEVICE_EXTERNAL_ID_PREFIX } = require('./constants');

/**
 * @description Extract the host of the first ffmpeg input of a camera, as an
 * informative hint of where the actual video source lives.
 * @param {object} cameraConfig - The camera section of the Frigate config.
 * @returns {string|null} The source host, or null when not parseable.
 * @example
 * getSourceHost({ ffmpeg: { inputs: [{ path: 'rtsp://10.6.0.8:554/live' }] } });
 */
const getSourceHost = (cameraConfig) => {
  const inputs = (cameraConfig.ffmpeg || {}).inputs || [];
  if (inputs.length === 0) {
    return null;
  }
  try {
    return new URL(String(inputs[0].path).replace(/^[a-z0-9+]+:/i, 'http:')).hostname;
  } catch (e) {
    return null;
  }
};

/**
 * @description List the cameras configured on the remote Frigate instance,
 * with their friendly name, trackable labels, source host and whether they
 * are already imported in Gladys, so the user can import them as devices.
 * @returns {Promise<Array>} Resolve with the discovered cameras.
 * @example
 * const cameras = await frigate.discoverRemoteCameras();
 */
async function discoverRemoteCameras() {
  if (this.mode !== MODES.REMOTE) {
    throw new ServiceNotConfiguredError('FRIGATE_NOT_IN_REMOTE_MODE');
  }
  const { data } = await this.remoteApiGet('/api/config');
  const cameras = data.cameras || {};
  return Object.keys(cameras).map((name) => {
    const trackedLabels = ((cameras[name].objects || {}).track || []).filter((label) =>
      TRACKABLE_LABELS.includes(label),
    );
    const alreadyImported =
      this.gladys.stateManager.get('deviceByExternalId', `${DEVICE_EXTERNAL_ID_PREFIX}:${name}`) !== null;
    return {
      name,
      friendlyName: cameras[name].friendly_name || null,
      sourceHost: getSourceHost(cameras[name]),
      trackedLabels,
      alreadyImported,
    };
  });
}

module.exports = {
  discoverRemoteCameras,
};
