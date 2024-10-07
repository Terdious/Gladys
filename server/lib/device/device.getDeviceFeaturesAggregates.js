const db = require('../../models');
const { NotFoundError } = require('../../utils/coreErrors');

const NON_BINARY_QUERY = (isDateRangeSpecified, startDate, endDate) => `
  WITH intervals AS (
        SELECT
            created_at,
            value,
            NTILE(?) OVER (ORDER BY created_at) AS interval
        FROM
            t_device_feature_state
        WHERE device_feature_id = ?
          ${!isDateRangeSpecified ? 'AND created_at > ?' : ''}
          ${startDate ? 'AND created_at >= ?' : ''}
          ${endDate ? 'AND created_at <= ?' : ''}
    )
    SELECT
        MIN(created_at) AS created_at,
        AVG(value) AS value
    FROM
        intervals
    GROUP BY
        interval
    ORDER BY
        created_at;
`;

const BINARY_QUERY = (isDateRangeSpecified, startDate, endDate) => `
  WITH value_changes AS (
      SELECT
          created_at,
          value,
          LAG(value) OVER (ORDER BY created_at) AS prev_value
      FROM
          t_device_feature_state
      WHERE
          device_feature_id = ?
          ${!isDateRangeSpecified ? 'AND created_at > ?' : ''}
          ${startDate ? 'AND created_at >= ?' : ''}
          ${endDate ? 'AND created_at <= ?' : ''}
      ORDER BY
          created_at DESC
  ),
  grouped_changes AS (
      SELECT
          created_at,
          value,
          CASE
              WHEN value != LAG(value) OVER (ORDER BY created_at) THEN created_at
              ELSE NULL
          END AS change_marker
      FROM
          value_changes
      ORDER BY
          created_at DESC
  ),
  final_grouping AS (
      SELECT
          created_at AS start_time,
          LEAD(created_at) OVER (ORDER BY created_at) AS end_time,
          value
      FROM
          grouped_changes
      WHERE
          change_marker IS NOT NULL
      ORDER BY
          created_at DESC
      LIMIT ?
  )
  SELECT
      value,
      start_time AS created_at,
      end_time
  FROM
      final_grouping
  ORDER BY
      created_at ASC
`;

/**
 * @description Get all features states aggregates.
 * @param {string} selector - Device selector.
 * @param {number} intervalInMinutes - Interval.
 * @param {number} maxStates - Number of elements to return max.
 * @param {Date} startDate - Start date.
 * @param {Date} endDate - End date.
 * @returns {Promise<object>} - Resolve with an array of data.
 * @example
 * device.getDeviceFeaturesAggregates('test-device');
 */
async function getDeviceFeaturesAggregates(
  selector,
  intervalInMinutes,
  maxStates = 100,
  startDate = null,
  endDate = null,
) {
  const deviceFeature = this.stateManager.get('deviceFeature', selector);
  if (deviceFeature === null) {
    throw new NotFoundError('DeviceFeature not found');
  }
  const device = this.stateManager.get('deviceById', deviceFeature.device_id);

  const isBinary = ['binary', 'push'].includes(deviceFeature.type);

  const now = new Date();
  let intervalDate;
  let effectiveStartDate = new Date(startDate);
  let effectiveEndDate = new Date(endDate);
  if (startDate === null && endDate === null) {
    intervalDate = new Date(now.getTime() - intervalInMinutes * 60 * 1000);
  } else if (startDate !== null && endDate === null) {
    intervalDate = new Date(effectiveStartDate.getTime() + intervalInMinutes * 60 * 1000);
    effectiveEndDate = intervalDate;
  } else if (startDate === null && endDate !== null) {
    intervalDate = new Date(effectiveEndDate.getTime() - intervalInMinutes * 60 * 1000);
    effectiveStartDate = intervalDate;
  } else {
    intervalDate = new Date(startDate);
  }
  const isDateRangeSpecified = startDate || endDate;

  let values;
  if (isBinary) {
    values = await db.duckDbReadConnectionAllAsync(
      BINARY_QUERY(isDateRangeSpecified, startDate, endDate),
      deviceFeature.id,
      ...(!isDateRangeSpecified ? [intervalDate] : []),
      ...(isDateRangeSpecified ? [new Date(effectiveStartDate)] : []),
      ...(isDateRangeSpecified ? [new Date(effectiveEndDate)] : []),
      maxStates
      
    );
  } else {
    values = await db.duckDbReadConnectionAllAsync(
      NON_BINARY_QUERY(isDateRangeSpecified, startDate, endDate),
      maxStates,
      deviceFeature.id,
      ...(!isDateRangeSpecified ? [intervalDate] : []),
      ...(isDateRangeSpecified ? [new Date(effectiveStartDate)] : []),
      ...(isDateRangeSpecified ? [new Date(effectiveEndDate)] : []),   
    );
  }

return {
    device: {
      name: device.name,
    },
    deviceFeature: {
      name: deviceFeature.name,
    },
    values,
  };
}

module.exports = {
  getDeviceFeaturesAggregates,
};
