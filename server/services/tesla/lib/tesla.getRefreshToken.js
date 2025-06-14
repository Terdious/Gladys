const { GLADYS_VARIABLES, STATUS } = require('./utils/tesla.constants');
const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

/**
 * @description Tesla get refresh token method.
 * @returns {Promise} Tesla refresh token.
 * @example
 * await tesla.getRefreshToken();
 */
async function getRefreshToken() {
  logger.debug('Loading Tesla refresh token...');
  const { serviceId } = this;
  try {
    this.refreshToken = await this.gladys.variable.getValue(GLADYS_VARIABLES.REFRESH_TOKEN, serviceId);
    this.expireInToken = await this.gladys.variable.getValue(GLADYS_VARIABLES.EXPIRE_IN_TOKEN, serviceId);
    if (!this.refreshToken) {
      const tokens = {
        accessToken: '',
        refreshToken: '',
        expireIn: '',
      };
      await this.setTokens(tokens);
      await this.saveStatus({ statusType: STATUS.DISCONNECTED, message: null });
      return undefined;
    }
    logger.debug(`Tesla refresh token well loaded`);
    return this.refreshToken;
  } catch (e) {
    this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
    throw new ServiceNotConfiguredError('Tesla is not configured.');
  }
}

module.exports = {
  getRefreshToken,
}; 