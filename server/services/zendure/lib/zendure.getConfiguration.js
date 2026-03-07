const { GLADYS_VARIABLES } = require('./utils/zendure.constants');

/**
 * @description Get Zendure service configuration.
 * @returns {Promise<object>} Zendure configuration.
 * @example
 * await getConfiguration();
 */
async function getConfiguration() {
  const appToken = await this.gladys.variable.getValue(GLADYS_VARIABLES.APP_TOKEN, this.serviceId);

  return {
    appToken,
  };
}

module.exports = {
  getConfiguration,
};
