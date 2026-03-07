const logger = require('../../../../utils/logger');

/**
 * @description Find one raw cloud device from external id.
 * @param {object} cloudData - Zendure cloud data cache.
 * @param {string} externalId - Gladys device external id.
 * @returns {object|null} Matching cloud device or null.
 * @example
 * findRawCloudDeviceByExternalId(this.cloudData, 'zendure:dCLTD95V');
 */
function findRawCloudDeviceByExternalId(cloudData, externalId) {
  if (!cloudData || !Array.isArray(cloudData.deviceList)) {
    return null;
  }
  const [, deviceKey] = String(externalId || '').split(':');
  if (!deviceKey) {
    return null;
  }
  const normalizedDeviceKey = deviceKey.toLowerCase();
  return (
    cloudData.deviceList.find((rawCloudDevice) => {
      const rawDeviceKey = String(rawCloudDevice.deviceKey || rawCloudDevice.id || '').toLowerCase();
      return rawDeviceKey === normalizedDeviceKey;
    }) || null
  );
}

/**
 * @description Post create hook for Zendure devices.
 * @param {object} device - Created device.
 * @returns {Promise<void>} Resolve when done.
 * @example
 * await postCreate(device);
 */
async function postCreate(device) {
  if (!device || !device.external_id || !device.external_id.startsWith('zendure:')) {
    return;
  }
  logger.debug(`Post creation of ${device.external_id}`);
  this.refreshMqttSubscriptions();
  const rawCloudDevice = findRawCloudDeviceByExternalId(this.cloudData, device.external_id);
  if (rawCloudDevice) {
    this.requestMqttDeviceProperties(rawCloudDevice);
  }
}

/**
 * @description Post update hook for Zendure devices.
 * @param {object} device - Updated device.
 * @returns {Promise<void>} Resolve when done.
 * @example
 * await postUpdate(device);
 */
async function postUpdate(device) {
  if (!device || !device.external_id || !device.external_id.startsWith('zendure:')) {
    return;
  }
  logger.debug(`Post update of ${device.external_id}`);
  this.refreshMqttSubscriptions();
  const rawCloudDevice = findRawCloudDeviceByExternalId(this.cloudData, device.external_id);
  if (rawCloudDevice) {
    this.requestMqttDeviceProperties(rawCloudDevice);
  }
}

/**
 * @description Post delete hook for Zendure devices.
 * @param {object} _device - Deleted device.
 * @example
 * postDelete(device);
 */
function postDelete(_device) {}

module.exports = {
  postCreate,
  postUpdate,
  postDelete,
};
