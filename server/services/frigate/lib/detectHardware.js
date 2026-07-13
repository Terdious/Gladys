const fs = require('fs/promises');
const path = require('path');

const logger = require('../../../utils/logger');
const { DEFAULT, CORAL_DEVICE_TYPES } = require('./constants');

/**
 * @description Detect hardware acceleration available on the host: an
 * Intel/AMD render node (VAAPI decoding + OpenVINO GPU detector) and a Google
 * Coral (PCIe apex device or USB, identified by its vendor id). The Gladys
 * container needs /dev mounted (reference deployment) to see the devices.
 * @returns {Promise<boolean>} Resolve with true when a render node is available.
 * @example
 * await frigate.detectHardware();
 */
async function detectHardware() {
  // Render node (VAAPI + OpenVINO GPU)
  this.vaapiAvailable = false;
  try {
    await fs.access(DEFAULT.RENDER_DEVICE_PATH);
    this.vaapiAvailable = true;
    logger.info(`Frigate: hardware acceleration available (${DEFAULT.RENDER_DEVICE_PATH})`);
  } catch (e) {
    logger.info('Frigate: no render node found, video decoding on CPU');
  }

  // Google Coral PCIe / M.2
  this.coralAvailable = false;
  this.coralDeviceType = null;
  try {
    await fs.access(DEFAULT.CORAL_PCIE_DEVICE_PATH);
    this.coralAvailable = true;
    this.coralDeviceType = CORAL_DEVICE_TYPES.PCIE;
    logger.info(`Frigate: Google Coral PCIe detected (${DEFAULT.CORAL_PCIE_DEVICE_PATH})`);
  } catch (e) {
    // Google Coral USB
    try {
      const usbDevices = await fs.readdir(DEFAULT.USB_SYS_DEVICES_PATH);
      const vendorIds = await Promise.all(
        usbDevices.map(async (usbDevice) => {
          try {
            const vendorId = await fs.readFile(path.join(DEFAULT.USB_SYS_DEVICES_PATH, usbDevice, 'idVendor'));
            return vendorId.toString().trim();
          } catch (readError) {
            return null;
          }
        }),
      );
      if (vendorIds.some((vendorId) => DEFAULT.CORAL_USB_VENDOR_IDS.includes(vendorId))) {
        this.coralAvailable = true;
        this.coralDeviceType = CORAL_DEVICE_TYPES.USB;
        logger.info('Frigate: Google Coral USB detected');
      }
    } catch (usbError) {
      logger.debug('Frigate: unable to scan USB devices for a Google Coral');
    }
  }

  return this.vaapiAvailable;
}

module.exports = {
  detectHardware,
};
