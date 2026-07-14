const axios = require('axios');
const { promisify } = require('util');

const logger = require('../../../utils/logger');
const { generate } = require('../../../utils/password');
const { CONFIGURATION, MODES } = require('./constants');

const sleep = promisify(setTimeout);

const MAX_ATTEMPTS = 3;

/**
 * @description Set the Frigate admin password from Gladys, so the user never
 * has to read container logs. Uses the documented password reset endpoint of
 * the internal unauthenticated Frigate API, which is bound to 127.0.0.1 only.
 * Frigate can announce itself on MQTT before its user database is ready, so
 * the call is retried a few times, and again on every stats message.
 * @returns {Promise} Resolve when the admin user is configured.
 * @example
 * await frigate.configureAdminUser();
 */
async function configureAdminUser() {
  // The remote instance already has its own admin account
  if (this.mode === MODES.REMOTE) {
    this.adminConfigured = true;
    return;
  }
  if (this.adminConfigured || this.adminConfiguring) {
    return;
  }
  this.adminConfiguring = true;

  try {
    const existingPassword = await this.gladys.variable.getValue(
      CONFIGURATION.FRIGATE_ADMIN_PASSWORD_KEY,
      this.serviceId,
    );
    if (existingPassword) {
      this.adminConfigured = true;
      return;
    }

    if (!this.frigateApiPort) {
      logger.warn('Frigate: cannot configure admin user, API port is not allocated yet');
      return;
    }

    const password = generate(20, {
      number: true,
      lowercase: true,
      uppercase: true,
    });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await axios.put(
          `http://127.0.0.1:${this.frigateApiPort}/api/users/${CONFIGURATION.FRIGATE_ADMIN_USERNAME_VALUE}/password`,
          {
            password,
          },
        );
        // eslint-disable-next-line no-await-in-loop
        await this.gladys.variable.setValue(CONFIGURATION.FRIGATE_ADMIN_PASSWORD_KEY, password, this.serviceId);
        this.adminConfigured = true;
        logger.info('Frigate: admin password successfully configured by Gladys');
        this.emitStatusEvent();
        return;
      } catch (e) {
        const responseDetails = e.response ? ` - ${e.response.status} ${JSON.stringify(e.response.data)}` : '';
        logger.warn(
          `Frigate: unable to configure admin password (attempt ${attempt}/${MAX_ATTEMPTS}) - ${e}${responseDetails}`,
        );
        if (attempt < MAX_ATTEMPTS) {
          // eslint-disable-next-line no-await-in-loop
          await sleep(this.containerRestartWaitTimeInMs);
        }
      }
    }
  } finally {
    this.adminConfiguring = false;
  }
}

module.exports = {
  configureAdminUser,
};
