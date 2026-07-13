/**
 * @description Parse a retention setting expressed in days. Invalid or
 * negative values fall back, so a broken value can never reach the
 * generated Frigate configuration.
 * @param {string|number} value - The stored value.
 * @param {number} fallback - Default number of days.
 * @returns {number} The number of days to keep.
 * @example
 * toRetentionDays('10', 2);
 */
function toRetentionDays(value, fallback) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/**
 * @description Extract the recording retention days present in a parsed
 * Frigate configuration (first camera having a record section).
 * @param {object} loadedConfig - Parsed Frigate configuration.
 * @returns {object} Days found in the file ({ continuous, alerts, detections }).
 * @example
 * const days = getRecordDaysFromConfig(yaml.parse(fileContent));
 */
function getRecordDaysFromConfig(loadedConfig) {
  const cameras = (loadedConfig && loadedConfig.cameras) || {};
  const record = Object.values(cameras)
    .map((camera) => camera && camera.record)
    .find((section) => section);
  if (!record) {
    return {};
  }
  return {
    continuous: record.continuous && record.continuous.days,
    alerts: record.alerts && record.alerts.retain && record.alerts.retain.days,
    detections: record.detections && record.detections.retain && record.detections.retain.days,
  };
}

module.exports = {
  toRetentionDays,
  getRecordDaysFromConfig,
};
