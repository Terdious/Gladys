const { GLADYS_VARIABLES, STATUS } = require('./utils/tesla.constants');
const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

/**
 * @description Tesla get access token.
 * @returns {Promise} Tesla access token.
 * @example
 * await tesla.getAccessToken();
 */
async function getAccessToken() {
  logger.debug('Loading Tesla access token...');
  const { serviceId } = this;
  try {
    this.accessToken = await this.gladys.variable.getValue(GLADYS_VARIABLES.ACCESS_TOKEN, serviceId);
    if (!this.accessToken || this.accessToken === '') {
      const tokens = {
        accessToken: '',
        refreshToken: '',
        expireIn: '',
      };
      await this.setTokens(tokens);
      await this.saveStatus({ statusType: STATUS.DISCONNECTED, message: null });
      return undefined;
    }
    logger.debug(`Tesla access token well loaded`);
    return this.accessToken;
  } catch (e) {
    this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
    throw new ServiceNotConfiguredError('Tesla is not configured.');
  }
}

module.exports = {
  getAccessToken,
};
