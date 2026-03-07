const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { mergeDevices } = require('../../../utils/device');

const { STATUS } = require('./utils/zendure.constants');
const { convertDevice } = require('./device/zendure.convertDevice');

/**
 * @description Discover Zendure cloud devices and convert them to Gladys devices.
 * @returns {Promise<Array>} List of discovered devices.
 * @example
 * await discoverDevices();
 */
async function discoverDevices() {
  logger.debug('Looking for Zendure devices...');

  if (this.status !== STATUS.CONNECTED) {
    await this.init();
  }

  this.status = STATUS.DISCOVERING_DEVICES;

  try {
    const rawDevices = await this.loadDevices(true);
    const convertedDevices = rawDevices.map((rawDevice) => ({
      ...convertDevice(rawDevice, this.serviceId),
      cloud_device: rawDevice,
    }));
    logger.debug(`Zendure discover converted ${convertedDevices.length} devices with cloud payload attached.`);
    this.discoveredDevices = convertedDevices.map((device) => {
      const existingDevice = this.gladys.stateManager.get('deviceByExternalId', device.external_id);
      return mergeDevices(device, existingDevice);
    });
    this.status = STATUS.CONNECTED;
    return this.discoveredDevices;
  } catch (e) {
    logger.error('Unable to load Zendure devices', e);
    if (e instanceof ServiceNotConfiguredError) {
      throw e;
    }
    this.status = STATUS.ERROR;
    throw e;
  }
}

module.exports = {
  discoverDevices,
};
