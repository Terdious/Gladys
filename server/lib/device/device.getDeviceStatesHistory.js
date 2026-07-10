const db = require('../../models');
const { BadParameters } = require('../../utils/coreErrors');

const DEFAULT_TAKE = 100;
const MAX_TAKE = 500;

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const ONE_DAY_IN_MS = 24 * ONE_HOUR_IN_MS;
// Lower time bounds (relative to the window reference, see below) of the disjoint,
// progressively wider time slices scanned until a full page is collected. Without a
// time bound, `ORDER BY created_at DESC LIMIT n` forces DuckDB to run a Top-N over
// every row that passes the filter (the whole table on the unfiltered "All" view),
// which is why the request took tens of seconds on large databases. Bounding
// `created_at` lets DuckDB skip row groups thanks to its per-row-group min/max
// metadata (zone maps): states are stored time-contiguously (live inserts are
// appended in order, and the SQLite -> DuckDB migration inserts each feature's
// history contiguously), so each slice only has to scan its own row groups.
// Each slice is queried once, results are accumulated across slices, and no row
// group is ever scanned twice: sparse categories (a few states per month) fill
// their page by accumulation instead of forcing an unbounded scan to find the
// whole page on its own. The final `null` bound scans the remaining history so
// older states are still returned when every bounded slice was sparse.
const PROGRESSIVE_SLICE_BOUNDS_IN_MS = [
  ONE_HOUR_IN_MS,
  ONE_DAY_IN_MS,
  7 * ONE_DAY_IN_MS,
  30 * ONE_DAY_IN_MS,
  365 * ONE_DAY_IN_MS,
  null,
];

/**
 * @description Get the history of device states across all devices, most recent first.
 * @param {object} [options] - Options of the query.
 * @param {string} [options.before] - Only return states created strictly before this date (pagination cursor).
 * @param {string} [options.before_id] - Device feature id of the last returned state, used as a tiebreaker
 * to paginate deterministically when several states share the same created_at.
 * @param {number} [options.take] - Max number of states to return.
 * @param {string} [options.categories] - Comma-separated list of device feature categories to filter on.
 * @param {string} [options.room_id] - Only return states of devices in this room.
 * @param {string} [options.search] - Only return states of devices whose name matches this search.
 * @returns {Promise<Array>} - Resolve with an array of states with device/feature/room metadata.
 * @example
 * const history = await gladys.device.getDeviceStatesHistory({ take: 50, categories: 'opening-sensor' });
 */
async function getDeviceStatesHistory(options = {}) {
  const take = Math.min(Math.max(parseInt(options.take, 10) || DEFAULT_TAKE, 1), MAX_TAKE);
  const before = options.before ? new Date(options.before) : new Date();
  if (Number.isNaN(before.getTime())) {
    throw new BadParameters(`Invalid "before" date: ${options.before}`);
  }
  const beforeId = options.before_id || null;

  const deviceFeatures = await db.DeviceFeature.findAll({
    attributes: ['id', 'name', 'selector', 'category', 'type', 'unit', 'last_value_changed'],
    include: [
      {
        model: db.Device,
        as: 'device',
        attributes: ['id', 'name', 'selector'],
        include: [
          {
            model: db.Room,
            as: 'room',
            attributes: ['id', 'name', 'selector'],
          },
        ],
      },
    ],
  });

  const featuresById = new Map();
  deviceFeatures.forEach((deviceFeature) => {
    featuresById.set(deviceFeature.id, deviceFeature.get({ plain: true }));
  });

  const categories = options.categories ? options.categories.split(',') : null;
  const search = options.search ? options.search.toLowerCase() : null;

  // Always constrain the query to the list of matching feature ids: it both
  // applies the filters and excludes states of deleted device features
  // (which would otherwise consume rows of the LIMIT).
  let maxLastValueChanged = null;
  const filteredFeatureIds = Array.from(featuresById.values())
    .filter((feature) => {
      if (categories && !categories.includes(feature.category)) {
        return false;
      }
      if (options.room_id && (!feature.device.room || feature.device.room.id !== options.room_id)) {
        return false;
      }
      if (search && !feature.device.name.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    })
    .map((feature) => {
      if (feature.last_value_changed) {
        const lastValueChanged = new Date(feature.last_value_changed);
        if (!maxLastValueChanged || lastValueChanged > maxLastValueChanged) {
          maxLastValueChanged = lastValueChanged;
        }
      }
      return feature.id;
    });
  if (filteredFeatureIds.length === 0) {
    return [];
  }

  // Anchor progressive windows on the most recent activity among filtered features
  // instead of always starting from `before` (usually "now"). Stale devices that
  // have not reported since months ago would otherwise exhaust every narrow window
  // before the unbounded fallback query runs.
  const windowReference = maxLastValueChanged && maxLastValueChanged < before ? maxLastValueChanged : before;

  // Keyset pagination on the compound key (created_at, device_feature_id). Ordering
  // and filtering on both columns guarantees that states sharing the same created_at
  // are never skipped when a page boundary falls in the middle of that timestamp.
  const cursorParams = [];
  let cursorClause;
  if (beforeId) {
    cursorClause =
      '(created_at < CAST(? AS TIMESTAMPTZ) OR (created_at = CAST(? AS TIMESTAMPTZ) AND device_feature_id < CAST(? AS UUID)))';
    cursorParams.push(before.toISOString(), before.toISOString(), beforeId);
  } else {
    cursorClause = 'created_at < CAST(? AS TIMESTAMPTZ)';
    cursorParams.push(before.toISOString());
  }

  const featureIdPlaceholders = filteredFeatureIds.map(() => '?').join(',');

  // Scan the history as disjoint time slices, newest first, accumulating results
  // until a full page is collected or the history is exhausted. The first slice is
  // bounded above by the pagination cursor; each following slice is bounded above
  // by the previous slice's lower bound, so no row is ever scanned or returned
  // twice. Slices are scanned in descending time order and rows are ordered inside
  // each slice, so plain concatenation keeps the global ordering.
  const rows = [];
  let previousLowerBound = null;
  for (let i = 0; i < PROGRESSIVE_SLICE_BOUNDS_IN_MS.length && rows.length < take; i += 1) {
    const boundInMs = PROGRESSIVE_SLICE_BOUNDS_IN_MS[i];
    const lowerBound = boundInMs === null ? null : new Date(windowReference.getTime() - boundInMs);
    const queryParams = [];
    let lowerBoundClause = '';
    if (lowerBound !== null) {
      lowerBoundClause = 'created_at >= CAST(? AS TIMESTAMPTZ) AND ';
      queryParams.push(lowerBound.toISOString());
    }
    let upperBoundClause;
    if (previousLowerBound === null) {
      // First slice: the pagination cursor is the upper bound.
      upperBoundClause = cursorClause;
      queryParams.push(...cursorParams);
    } else {
      upperBoundClause = 'created_at < CAST(? AS TIMESTAMPTZ)';
      queryParams.push(previousLowerBound.toISOString());
    }
    queryParams.push(...filteredFeatureIds, take - rows.length);

    const query = `
      SELECT device_feature_id, value, created_at
      FROM t_device_feature_state
      WHERE ${lowerBoundClause}${upperBoundClause}
      AND device_feature_id IN (${featureIdPlaceholders})
      ORDER BY created_at DESC, device_feature_id DESC
      LIMIT ?
    `;

    // eslint-disable-next-line no-await-in-loop
    const sliceRows = await db.duckDbReadConnectionAllAsync(query, ...queryParams);
    rows.push(...sliceRows);
    previousLowerBound = lowerBound;
  }

  return rows
    .filter((row) => featuresById.has(row.device_feature_id))
    .map((row) => {
      const feature = featuresById.get(row.device_feature_id);
      return {
        value: row.value,
        created_at: row.created_at,
        device_feature: {
          id: feature.id,
          name: feature.name,
          selector: feature.selector,
          category: feature.category,
          type: feature.type,
          unit: feature.unit,
        },
        device: {
          name: feature.device.name,
          selector: feature.device.selector,
        },
        room: feature.device.room
          ? {
              name: feature.device.room.name,
              selector: feature.device.room.selector,
            }
          : null,
      };
    });
}

module.exports = {
  getDeviceStatesHistory,
};
