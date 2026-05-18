const logger = require('../../../utils/logger');
const { GLADYS_VARIABLES } = require('./utils/tesla.constants');

/**
 * @description Tesla save token method.
 * @param {object} tokens - Tesla tokens.
 * @returns {Promise<boolean>} Tesla well set Tokens.
 * @example
 * await tesla.setTokens({ access_token: '...', refresh_token:'...', expire_time: ...});
 */
async function setTokens(tokens) {
  logger.debug('Storing Tesla tokens...');
  const { serviceId } = this;
  const { accessToken, refreshToken, expireIn } = tokens;
  try {
    await this.gladys.variable.setValue(GLADYS_VARIABLES.ACCESS_TOKEN, accessToken, serviceId);
    await this.gladys.variable.setValue(GLADYS_VARIABLES.REFRESH_TOKEN, refreshToken, serviceId);
    await this.gladys.variable.setValue(GLADYS_VARIABLES.EXPIRE_IN_TOKEN, expireIn, serviceId);
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expireInToken = expireIn;
    logger.debug('Tesla tokens well stored');
    return true;
  } catch (e) {
    logger.error('Tesla tokens stored errored', e);
    return false;
  }
}

module.exports = {
  setTokens,
};
