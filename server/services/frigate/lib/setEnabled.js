const logger = require('../../../utils/logger');
const { CONFIGURATION } = require('./constants');

/**
 * @description Enable or disable the Frigate integration.
 * @param {boolean} enabled - True to enable the integration.
 * @returns {Promise} Resolve when the state is stored.
 * @example
 * await frigate.setEnabled(true);
 */
async function setEnabled(enabled) {
  logger.info(`Frigate: setting integration enabled = ${enabled}`);
  this.frigateEnabled = enabled;
  await this.gladys.variable.setValue(CONFIGURATION.FRIGATE_ENABLED, enabled ? '1' : '0', this.serviceId);
  this.emitStatusEvent();
}

module.exports = {
  setEnabled,
};
