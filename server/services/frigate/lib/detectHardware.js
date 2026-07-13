const fs = require('fs/promises');
const path = require('path');

const logger = require('../../../utils/logger');
const { DEFAULT, CORAL_DEVICE_TYPES, GPU_VENDORS } = require('./constants');

/**
 * @description Pick the render node to expose to Frigate. Multi-GPU hosts
 * (e.g. a laptop with an Intel iGPU and an NVIDIA card) get several render
 * nodes in a driver-dependent order: the vendor of each node is read from
 * sysfs to select an Intel one (OpenVINO GPU + VAAPI), or an AMD one (VAAPI
 * decoding only).
 * @returns {Promise<object>} Resolve with { renderDevicePath, openvinoCapable }.
 * @example
 * const renderNode = await pickRenderNode();
 */
async function pickRenderNode() {
  const driEntries = await fs.readdir(DEFAULT.DRM_DEVICES_PATH);
  const renderNodes = driEntries.filter((entry) => entry.startsWith('renderD'));
  if (renderNodes.length === 0) {
    return null;
  }
  const nodesWithVendor = await Promise.all(
    renderNodes.map(async (node) => {
      try {
        const vendor = await fs.readFile(path.join(DEFAULT.DRM_SYS_CLASS_PATH, node, 'device/vendor'));
        return { node, vendor: vendor.toString().trim() };
      } catch (e) {
        return { node, vendor: null };
      }
    }),
  );
  const intelNode = nodesWithVendor.find(({ vendor }) => vendor === GPU_VENDORS.INTEL);
  if (intelNode) {
    return { renderDevicePath: path.join(DEFAULT.DRM_DEVICES_PATH, intelNode.node), openvinoCapable: true };
  }
  // AMD GPUs decode through VAAPI but cannot run the OpenVINO GPU detector
  const amdNode = nodesWithVendor.find(({ vendor }) => vendor === GPU_VENDORS.AMD);
  if (amdNode) {
    return { renderDevicePath: path.join(DEFAULT.DRM_DEVICES_PATH, amdNode.node), openvinoCapable: false };
  }
  // Vendor unreadable (unusual /sys setup): keep the historical behavior on
  // the default node rather than losing a working acceleration
  const unknownVendorNode = nodesWithVendor.find(({ vendor }) => vendor === null);
  if (unknownVendorNode && renderNodes.length === nodesWithVendor.filter(({ vendor }) => vendor === null).length) {
    logger.warn('Frigate: unable to read the GPU vendors, assuming an Intel render node');
    return { renderDevicePath: DEFAULT.RENDER_DEVICE_PATH, openvinoCapable: true };
  }
  // Only incompatible GPUs (NVIDIA...): no usable render node
  return null;
}

/**
 * @description Detect hardware acceleration available on the host: a
 * compatible render node (VAAPI decoding, OpenVINO GPU detector on Intel) and
 * a Google Coral (PCIe apex device or USB, identified by its vendor id). The
 * Gladys container needs /dev mounted (reference deployment) to see the
 * devices.
 * @returns {Promise<boolean>} Resolve with true when a render node is available.
 * @example
 * await frigate.detectHardware();
 */
async function detectHardware() {
  // Render node (VAAPI decoding, OpenVINO GPU detector on Intel)
  this.vaapiAvailable = false;
  this.openvinoCapable = false;
  this.renderDevicePath = null;
  try {
    const renderNode = await pickRenderNode();
    if (renderNode) {
      this.renderDevicePath = renderNode.renderDevicePath;
      this.openvinoCapable = renderNode.openvinoCapable;
      this.vaapiAvailable = true;
      logger.info(
        `Frigate: hardware acceleration available (${this.renderDevicePath}, OpenVINO: ${this.openvinoCapable})`,
      );
    } else {
      logger.info('Frigate: no compatible render node found, video decoding on CPU');
    }
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
