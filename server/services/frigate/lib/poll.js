const logger = require('../../../utils/logger');

/**
 * @description Poll the latest image of a camera device.
 * @param {object} device - The camera device to poll.
 * @returns {Promise} Resolve when the image is refreshed.
 * @example
 * await frigate.poll(device);
 */
async function poll(device) {
  if (!this.frigateConnected) {
    // Frigate is starting or stopped: don't flood it (and the logs)
    logger.debug(`Frigate: skipping poll of camera ${device.selector}, Frigate is not connected`);
    return;
  }
  try {
    const image = await this.getImage(device);
    await this.gladys.device.camera.setImage(device.selector, image);
  } catch (e) {
    logger.warn(`Frigate: unable to poll camera ${device.selector} - ${e}`);
  }
}

module.exports = {
  poll,
};
