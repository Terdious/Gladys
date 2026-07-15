const {
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_UNITS,
} = require('../../../../../utils/constants');

// Wifi watering/irrigation valve controller (e.g. "Valve Controller" wt_wifi_v2).
// The valve switch and the battery level map to Gladys concepts. Only pure
// firmware plumbing is ignored (log server, device token, timestamps, version
// strings, feature bitmasks): no user would ever request those as features.
// Every functional capability (child lock, watering programs, valve status,
// fault, hydraulic pressure...) is deliberately left unknown, NOT ignored: it
// stays visible as unsupported and keeps the "propose features" GitHub issue
// flow available for future mapping work.
module.exports = {
  ignoredCodes: [
    'app_features',
    'dev_state',
    'dev_token',
    'log_server_port',
    'log_server_url',
    'mfg_model',
    'soft_ver',
    'support_features',
    'unix_time',
  ],
  switch: {
    name: 'Switch',
    category: DEVICE_FEATURE_CATEGORIES.SWITCH,
    type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
  },
  battery_percentage: {
    name: 'Battery',
    category: DEVICE_FEATURE_CATEGORIES.BATTERY,
    type: DEVICE_FEATURE_TYPES.BATTERY.INTEGER,
    unit: DEVICE_FEATURE_UNITS.PERCENT,
    read_only: true,
    min: 0,
    max: 100,
  },
  // Aligned with the shared water-valve core (SONOFF SWV, PR #2631): the valve
  // running state reuses WATER_VALVE.VALVE_WORK_STATE. Flow / irrigation-duration
  // / volume DPs are intentionally left unsupported (device reports 0 or opaque
  // base64 blobs with no documented scale — mapping them would be guesswork), and
  // child_lock stays unsupported here because its read/write handlers live in a
  // later branch of the stack (kept out of this PR6-Bis-based scope).
  valve_status: {
    name: 'Valve state',
    category: DEVICE_FEATURE_CATEGORIES.WATER_VALVE,
    type: DEVICE_FEATURE_TYPES.WATER_VALVE.VALVE_WORK_STATE,
    read_only: true,
  },
};
