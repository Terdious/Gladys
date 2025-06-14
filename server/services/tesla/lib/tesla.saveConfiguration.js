const logger = require('../../../utils/logger');

const { GLADYS_VARIABLES } = require('./utils/tesla.constants');

/**
 * @description Save Tesla configuration.
 * @param {object} configuration - Configuration to save.
 * @returns {Promise<boolean>} Tesla well save configuration.
 * @example
 * await saveConfiguration({ clientId: '...', clientSecret: '...', vehicleApi: true, energyApi: true });
 */
async function saveConfiguration(configuration) {
    logger.debug('Saving Tesla configuration...');
    const { clientId, clientSecret, vehicleApi, energyApi } = configuration;
    try {
        await this.gladys.variable.setValue(GLADYS_VARIABLES.CLIENT_ID, clientId, this.serviceId);
        await this.gladys.variable.setValue(GLADYS_VARIABLES.CLIENT_SECRET, clientSecret, this.serviceId);
        await this.gladys.variable.setValue(GLADYS_VARIABLES.VEHICLE_API, vehicleApi, this.serviceId);
        await this.gladys.variable.setValue(GLADYS_VARIABLES.ENERGY_API, energyApi, this.serviceId);
        this.configuration.clientId = clientId;
        this.configuration.clientSecret = clientSecret;
        this.configuration.vehicleApi = vehicleApi;
        this.configuration.energyApi = energyApi;
        logger.debug('Tesla configuration well stored');
        return true;
    } catch (e) {
        logger.error('Tesla configuration stored errored', e);
        return false;
    }
}

module.exports = {
    saveConfiguration,
}; 