const axios = require('axios');

const logger = require('../../../utils/logger');
const { generate } = require('../../../utils/password');
const { CONFIGURATION } = require('./constants');

/**
 * @description Set the Frigate admin password from Gladys, so the user never
 * has to read container logs. Uses the documented password reset endpoint of
 * the internal unauthenticated Frigate API, which is bound to 127.0.0.1 only.
 * @returns {Promise} Resolve when the admin user is configured.
 * @example
 * await frigate.configureAdminUser();
 */
async function configureAdminUser() {
  if (this.adminConfigured) {
    return;
  }

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

  try {
    await axios.put(
      `http://127.0.0.1:${this.frigateApiPort}/api/users/${CONFIGURATION.FRIGATE_ADMIN_USERNAME_VALUE}/password`,
      {
        password,
      },
    );
    await this.gladys.variable.setValue(CONFIGURATION.FRIGATE_ADMIN_PASSWORD_KEY, password, this.serviceId);
    this.adminConfigured = true;
    logger.info('Frigate: admin password successfully configured by Gladys');
  } catch (e) {
    logger.warn(`Frigate: unable to configure admin password - ${e}`);
  }
}

module.exports = {
  configureAdminUser,
};
