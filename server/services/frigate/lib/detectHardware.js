const fs = require('fs/promises');

const logger = require('../../../utils/logger');
const { DEFAULT } = require('./constants');

/**
 * @description Detect hardware acceleration available on the host. The Gladys
 * container needs /dev mounted (reference deployment) to see the render node.
 * @returns {Promise<boolean>} Resolve with true when an Intel/AMD render node is available.
 * @example
 * const vaapiAvailable = await frigate.detectHardware();
 */
async function detectHardware() {
  try {
    await fs.access(DEFAULT.RENDER_DEVICE_PATH);
    logger.info(`Frigate: hardware acceleration available (${DEFAULT.RENDER_DEVICE_PATH})`);
    return true;
  } catch (e) {
    logger.info('Frigate: no render node found, running on CPU');
    return false;
  }
}

module.exports = {
  detectHardware,
};
