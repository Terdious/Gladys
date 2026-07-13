const { DEFAULT } = require('./constants');

/**
 * @description Compute the shared memory size of the Frigate container:
 * the Docker default (64MB) makes Frigate crash, 256MB is validated for one
 * camera, and each extra camera gets additional headroom.
 * @param {number} cameraCount - Number of configured cameras.
 * @returns {number} The shm size in bytes.
 * @example
 * const shmSize = computeShmSize(2);
 */
function computeShmSize(cameraCount) {
  const extraCameras = Math.max(0, cameraCount - 1);
  return DEFAULT.SHM_BASE_BYTES + extraCameras * DEFAULT.SHM_PER_EXTRA_CAMERA_BYTES;
}

module.exports = {
  computeShmSize,
};
