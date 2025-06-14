const logger = require('../../../utils/logger');
const { STATUS } = require('./utils/tesla.constants');

/**
 * @description Disconnects service and dependencies.
 * @example
 * disconnect();
 */
function disconnect() {
    logger.debug('Disconnecting from Tesla...');
    this.saveStatus({ statusType: STATUS.DISCONNECTING, message: null });
    const tokens = {
        accessToken: '',
        refreshToken: '',
        expireIn: 0,
    };
    this.setTokens(tokens);
    this.saveStatus({ statusType: STATUS.DISCONNECTED, message: null });
    logger.debug('Tesla disconnected');
}

module.exports = {
    disconnect,
}; 