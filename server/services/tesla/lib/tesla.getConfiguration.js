const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const logger = require('../../../utils/logger');
const { GLADYS_VARIABLES, STATUS } = require('./utils/tesla.constants');

/**
 * @description Loads Tesla stored configuration.
 * @returns {Promise} Tesla configuration.
 * @example
 * await getConfiguration();
 */
async function getConfiguration() {
  logger.debug('Loading Tesla configuration...');
  const { serviceId } = this;
  try {
    this.configuration.clientId = await this.gladys.variable.getValue(GLADYS_VARIABLES.CLIENT_ID, serviceId);
    this.configuration.clientSecret = await this.gladys.variable.getValue(GLADYS_VARIABLES.CLIENT_SECRET, serviceId);
    this.configuration.vehicleApi =
      (await this.gladys.variable.getValue(GLADYS_VARIABLES.VEHICLE_API, serviceId)) === '1';
    logger.debug(`Tesla configuration get: clientId='${this.configuration.clientId}'`);
    return this.configuration;
  } catch (e) {
    this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
    throw new ServiceNotConfiguredError('Tesla is not configured.');
  }
}

module.exports = {
  getConfiguration,
};
