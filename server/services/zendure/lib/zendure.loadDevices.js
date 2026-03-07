/**
 * @description Load Zendure cloud devices.
 * @param {boolean} refreshCloud - Refresh cloud data before returning devices.
 * @returns {Promise<Array>} List of Zendure cloud devices.
 * @example
 * await loadDevices();
 */
async function loadDevices(refreshCloud = true) {
  if (refreshCloud || !this.cloudData) {
    const configuration = await this.getConfiguration();
    await this.connect(configuration);
  }

  if (!this.cloudData || !Array.isArray(this.cloudData.deviceList)) {
    return [];
  }

  this.lastCloudRefreshAt = Date.now();
  return this.cloudData.deviceList;
}

module.exports = {
  loadDevices,
};
