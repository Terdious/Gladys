const logger = require('../../../utils/logger');
const { MODES } = require('./constants');

/**
 * @description Regenerate the Frigate configuration file from Gladys devices
 * without restarting Frigate. When the file actually changed, the service is
 * flagged as pending a restart so the user can batch several camera changes
 * and reload Frigate only once.
 * @returns {Promise<object>} Indicates if the config changed and if a restart is pending.
 * @example
 * await frigate.writeConfig();
 */
async function writeConfig() {
  if (!this.frigateEnabled || this.mode === MODES.REMOTE) {
    logger.debug('Frigate: integration disabled or remote, not writing configuration');
    return { configChanged: false, configPendingRestart: false };
  }
  const { basePathOnContainer } = await this.gladys.system.getGladysBasePath();
  const config = await this.getConfiguration();
  const { configChanged } = await this.configureContainer(basePathOnContainer, config);
  if (configChanged) {
    this.configPendingRestart = true;
    this.emitStatusEvent();
  }
  return { configChanged, configPendingRestart: this.configPendingRestart };
}

module.exports = {
  writeConfig,
};
