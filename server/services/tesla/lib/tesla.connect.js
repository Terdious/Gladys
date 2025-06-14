const crypto = require('crypto');

const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

const { STATUS, AUTHENTICATION } = require('./utils/tesla.constants');

/**
 * @description Connect to Tesla and getting code to get access tokens.
 * @returns {Promise} Tesla access token.
 * @example
 * connect();
 */
async function connect() {
  const { clientId, clientSecret } = this.configuration;
  if (!clientId || !clientSecret) {
    await this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
    throw new ServiceNotConfiguredError('Tesla is not configured.');
  }
  await this.saveStatus({ statusType: STATUS.CONNECTING, message: null });
  logger.debug('Connecting to Tesla...');

  this.stateGetAccessToken = crypto.randomBytes(16).toString('hex');
  
  const params = {
    client_id: clientId,
    locale: 'fr_FR',
    response_type: 'code',
    // redirectUri: 'http://localhost:1444',
    state: this.stateGetAccessToken,
    prompt: 'login',
    scope: Object.values(AUTHENTICATION.scopeOauth).join(' '),
    audience: AUTHENTICATION.audience.EU,
  };
  const paramsString = new URLSearchParams(params).toString();
  this.redirectUri = `${AUTHENTICATION.urlOauth}?${paramsString}`;

  // const scopeValues = Object.values(AUTHENTICATION.scopeOauth).join(' ');
  // this.redirectUri = `${AUTHENTICATION.urlOauth}?client_id=${clientId}&scope=${encodeURIComponent(scopeValues)}&state=${this.stateGetAccessToken}`;
  
  this.configured = true;
  return { authUrl: this.redirectUri, state: this.stateGetAccessToken };
}

module.exports = {
  connect,
}; 