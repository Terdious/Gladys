const { STATUS } = require('./utils/zendure.constants');

/**
 * @description Get Zendure connection status.
 * @returns {Promise<object>} Zendure status.
 * @example
 * await getStatus();
 */
async function getStatus() {
  const { appToken } = await this.getConfiguration();
  const configured = Boolean(appToken && appToken.trim());
  const hasCloudDevices =
    this.cloudData && Array.isArray(this.cloudData.deviceList) && this.cloudData.deviceList.length > 0;

  return {
    configured,
    connected: this.status === STATUS.CONNECTED && hasCloudDevices,
    status: this.status,
  };
}

module.exports = {
  getStatus,
};
