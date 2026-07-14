const https = require('https');
const axios = require('axios');

const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

// The remote Frigate authenticated port uses a self-signed certificate
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * @description Login on the remote Frigate authenticated port and store the
 * JWT token (24h by default, renewed on 401 by remoteApiGet).
 * @returns {Promise} Resolve when logged in.
 * @example
 * await frigate.remoteLogin();
 */
async function remoteLogin() {
  if (!this.remote || !this.remote.host) {
    throw new ServiceNotConfiguredError('FRIGATE_REMOTE_NOT_CONFIGURED');
  }
  const response = await axios.post(
    `https://${this.remote.host}:${this.remote.port}/api/login`,
    { user: this.remote.username, password: this.remote.password },
    { httpsAgent },
  );
  const cookies = response.headers['set-cookie'] || [];
  const tokenCookie = cookies.map((cookie) => cookie.match(/frigate_token=([^;]+)/)).find((match) => match);
  if (!tokenCookie) {
    throw new ServiceNotConfiguredError('FRIGATE_REMOTE_LOGIN_FAILED');
  }
  [, this.remoteAuthToken] = tokenCookie;
  logger.debug('Frigate: logged in on the remote instance');
}

/**
 * @description Authenticated GET on the remote Frigate instance, with a
 * single re-login retry when the token expired.
 * @param {string} path - API path (e.g. /api/config).
 * @param {object} [options] - Axios options (responseType...).
 * @returns {Promise<object>} Resolve with the axios response.
 * @example
 * const { data } = await frigate.remoteApiGet('/api/config');
 */
async function remoteApiGet(path, options = {}) {
  if (!this.remoteAuthToken) {
    await this.remoteLogin();
  }
  const requestOptions = {
    ...options,
    httpsAgent,
    headers: { Authorization: `Bearer ${this.remoteAuthToken}` },
  };
  const url = `https://${this.remote.host}:${this.remote.port}${path}`;
  try {
    return await axios.get(url, requestOptions);
  } catch (e) {
    if (e.response && e.response.status === 401) {
      await this.remoteLogin();
      requestOptions.headers = { Authorization: `Bearer ${this.remoteAuthToken}` };
      return axios.get(url, requestOptions);
    }
    throw e;
  }
}

module.exports = {
  remoteLogin,
  remoteApiGet,
};
