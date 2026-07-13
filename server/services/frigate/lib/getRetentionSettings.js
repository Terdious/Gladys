const fs = require('fs/promises');
const path = require('path');
const yaml = require('yaml');

const logger = require('../../../utils/logger');
const { DEFAULT } = require('./constants');
const { toRetentionDays, getRecordDaysFromConfig } = require('../utils/retention');

/**
 * @description Get the effective recording retention. The configuration file
 * is what Frigate actually applies, so it wins over the Gladys variables:
 * a retention changed through the Frigate UI is reported correctly.
 * @returns {Promise<object>} Retention days ({ continuous, alerts, detections }).
 * @example
 * const retention = await frigate.getRetentionSettings();
 */
async function getRetentionSettings() {
  let fileDays = {};
  try {
    const { basePathOnContainer } = await this.gladys.system.getGladysBasePath();
    const configFilepath = path.join(basePathOnContainer, DEFAULT.CONFIGURATION_PATH);
    const fileContent = (await fs.readFile(configFilepath)).toString();
    fileDays = getRecordDaysFromConfig(yaml.parse(fileContent) || {});
  } catch (e) {
    logger.debug(`Frigate: unable to read retention from the configuration file - ${e}`);
  }

  const config = await this.getConfiguration();

  return {
    continuous: toRetentionDays(
      fileDays.continuous,
      toRetentionDays(config.recordContinuousDays, DEFAULT.RECORD_CONTENT.continuous.days),
    ),
    alerts: toRetentionDays(
      fileDays.alerts,
      toRetentionDays(config.recordAlertsDays, DEFAULT.RECORD_CONTENT.alerts.retain.days),
    ),
    detections: toRetentionDays(
      fileDays.detections,
      toRetentionDays(config.recordDetectionsDays, DEFAULT.RECORD_CONTENT.detections.retain.days),
    ),
  };
}

module.exports = {
  getRetentionSettings,
};
