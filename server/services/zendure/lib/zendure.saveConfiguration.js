const { GLADYS_VARIABLES } = require('./utils/zendure.constants');

/**
 * @description Save Zendure service configuration.
 * @param {object} configuration - Zendure configuration.
 * @returns {Promise<object>} Saved configuration.
 * @example
 * await saveConfiguration({ appToken: '...' });
 */
async function saveConfiguration(configuration) {
  const { appToken } = configuration;

  await this.gladys.variable.setValue(GLADYS_VARIABLES.APP_TOKEN, appToken, this.serviceId);

  return {
    appToken,
  };
}

module.exports = {
  saveConfiguration,
};
