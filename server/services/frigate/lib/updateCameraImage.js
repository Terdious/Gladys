const logger = require('../../../utils/logger');
const { DEVICE_EXTERNAL_ID_PREFIX } = require('./constants');

/**
 * @description Refresh the Gladys image of a camera, typically when a
 * detection starts, so the dashboard shows a fresh snapshot in real time.
 * @param {string} cameraName - The Frigate camera name.
 * @returns {Promise} Resolve when the image is refreshed.
 * @example
 * await frigate.updateCameraImage('c660');
 */
async function updateCameraImage(cameraName) {
  const device = this.gladys.stateManager.get('deviceByExternalId', `${DEVICE_EXTERNAL_ID_PREFIX}:${cameraName}`);
  if (!device) {
    return;
  }
  try {
    const image = await this.getImage(device);
    await this.gladys.device.camera.setImage(device.selector, image);
  } catch (e) {
    logger.warn(`Frigate: unable to refresh image of camera ${cameraName} - ${e}`);
  }
}

module.exports = {
  updateCameraImage,
};
