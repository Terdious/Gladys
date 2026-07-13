const logger = require('../../../utils/logger');
const { DEVICE_EXTERNAL_ID_PREFIX } = require('./constants');

/**
 * @description Store the last detection snapshot of a label, published by
 * Frigate on the frigate/<camera>/<label>/snapshot MQTT topic, in the
 * dedicated image feature of the camera device.
 * @param {string} cameraName - The Frigate camera name.
 * @param {string} label - The detected object label.
 * @param {Buffer} imageBuffer - The JPEG snapshot.
 * @returns {Promise} Resolve when the image is stored.
 * @example
 * await frigate.updateLabelImage('c660', 'person', imageBuffer);
 */
async function updateLabelImage(cameraName, label, imageBuffer) {
  const featureExternalId = `${DEVICE_EXTERNAL_ID_PREFIX}:${cameraName}:${label}:image`;
  const feature = this.gladys.stateManager.get('deviceFeatureByExternalId', featureExternalId);
  if (!feature) {
    logger.debug(`Frigate: no image feature for ${featureExternalId}`);
    return;
  }
  const device = this.gladys.stateManager.get('deviceByExternalId', `${DEVICE_EXTERNAL_ID_PREFIX}:${cameraName}`);
  if (!device) {
    return;
  }
  try {
    const image = `image/jpeg;base64,${imageBuffer.toString('base64')}`;
    await this.gladys.device.camera.setImage(device.selector, image, feature.selector);
    logger.debug(`Frigate: updated last ${label} image of camera ${cameraName}`);
  } catch (e) {
    logger.warn(`Frigate: unable to update last ${label} image of camera ${cameraName} - ${e}`);
  }
}

module.exports = {
  updateLabelImage,
};
