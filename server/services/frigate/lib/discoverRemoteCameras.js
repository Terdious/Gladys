const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { MODES, TRACKABLE_LABELS, DEVICE_EXTERNAL_ID_PREFIX } = require('./constants');

/**
 * @description List the cameras configured on the remote Frigate instance,
 * with their trackable labels and whether they are already imported in
 * Gladys, so the user can import them as devices.
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
    return { name, trackedLabels, alreadyImported };
  });
}

module.exports = {
  discoverRemoteCameras,
};
