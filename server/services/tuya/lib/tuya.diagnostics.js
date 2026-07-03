// In-memory diagnostics collector for the Tuya integration. Feeds the front diagnostic page so a
// remote tester can watch, filter and copy structured events (connection lifecycle, raw pushed DPS,
// poll summaries, commands, errors) per device without shell access to the server logs. The buffer
// lives in process memory only (reset on restart) and is bounded, so it can stay always-on.
const DIAGNOSTICS_MAX_ENTRIES = 1000;
// Raw DPS payloads (e.g. doorbell pictures references) can be large: cap what one entry stores so
// the buffer stays small while keeping enough of the payload to be copy-pasted and analyzed.
const DIAGNOSTICS_MAX_DATA_LENGTH = 4096;

const DIAGNOSTIC_LEVELS = ['debug', 'info', 'warn', 'error'];

const serializeData = (data) => {
  if (data === undefined || data === null) {
    return undefined;
  }
  let serialized;
  try {
    serialized = typeof data === 'string' ? data : JSON.stringify(data);
  } catch (e) {
    serialized = String(data);
  }
  if (serialized.length > DIAGNOSTICS_MAX_DATA_LENGTH) {
    return `${serialized.slice(0, DIAGNOSTICS_MAX_DATA_LENGTH)}... (truncated)`;
  }
  return serialized;
};

/**
 * @description Record a structured diagnostic entry in the in-memory ring buffer.
 * @param {string} level - One of debug|info|warn|error (anything else is coerced to info).
 * @param {string} deviceId - The Tuya device id the entry relates to (null for service-wide events).
 * @param {string} event - Short machine-readable event key (e.g. 'push_dps', 'poll_summary').
 * @param {string} message - Human-readable message.
 * @param {object|string} [data] - Optional payload (raw DPS, command, error), serialized + truncated.
 * @example
 * this.recordDiagnostic('info', 'device-id', 'push_dps', 'DPS pushed', { '1': true });
 */
function recordDiagnostic(level, deviceId, event, message, data) {
  if (!this.diagnosticsEntries) {
    this.diagnosticsEntries = [];
    this.diagnosticsLastId = 0;
  }
  this.diagnosticsLastId += 1;
  this.diagnosticsEntries.push({
    id: this.diagnosticsLastId,
    ts: new Date().toISOString(),
    level: DIAGNOSTIC_LEVELS.includes(level) ? level : 'info',
    device_id: deviceId || null,
    event,
    message,
    data: serializeData(data),
  });
  if (this.diagnosticsEntries.length > DIAGNOSTICS_MAX_ENTRIES) {
    this.diagnosticsEntries.splice(0, this.diagnosticsEntries.length - DIAGNOSTICS_MAX_ENTRIES);
  }
}

/**
 * @description Return diagnostic entries, filtered and incrementally paginated.
 * @param {object} [options] - Filters.
 * @param {string} [options.deviceId] - Only entries for this device (service-wide entries excluded).
 * @param {string} [options.level] - Minimum level (debug returns everything, error only errors).
 * @param {number} [options.sinceId] - Only entries with id strictly greater (incremental polling).
 * @returns {object} { entries, lastId } — lastId to pass back as sinceId on the next poll.
 * @example
 * const { entries, lastId } = this.getDiagnostics({ deviceId: 'device-id', sinceId: 42 });
 */
function getDiagnostics({ deviceId, level, sinceId } = {}) {
  const entries = this.diagnosticsEntries || [];
  const minLevelIndex = DIAGNOSTIC_LEVELS.includes(level) ? DIAGNOSTIC_LEVELS.indexOf(level) : 0;
  const parsedSinceId = Number(sinceId);
  const effectiveSinceId = Number.isFinite(parsedSinceId) ? parsedSinceId : 0;
  const filtered = entries.filter((entry) => {
    if (entry.id <= effectiveSinceId) {
      return false;
    }
    if (deviceId && entry.device_id !== deviceId) {
      return false;
    }
    return DIAGNOSTIC_LEVELS.indexOf(entry.level) >= minLevelIndex;
  });
  return {
    entries: filtered,
    lastId: this.diagnosticsLastId || 0,
  };
}

// Raw-value memory: the last raw value seen per device, keyed both by DPS id (local paths) and by
// Tuya code (cloud path), with its origin and timestamp. Feeds the device-snapshot endpoint so the
// diagnostic page can show the device INPUT next to the transformed Gladys value.
const RAW_VALUE_MAX_LENGTH = 512;

const truncateRawValue = (value) => {
  if (typeof value !== 'string' || value.length <= RAW_VALUE_MAX_LENGTH) {
    return value;
  }
  return `${value.slice(0, RAW_VALUE_MAX_LENGTH)}... (truncated)`;
};

/**
 * @description Remember the last raw values seen for a device (keyed by DPS id or Tuya code).
 * @param {string} topic - The Tuya device id.
 * @param {string} origin - Where the values came from (local_push|local_poll|cloud).
 * @param {object} values - Map of dps-id-or-code -> raw value.
 * @param {string} keyKind - 'dps' or 'codes' depending on the map keys.
 * @example
 * this.recordRawValues('device-id', 'local_push', { '1': true }, 'dps');
 */
function recordRawValues(topic, origin, values, keyKind) {
  if (!topic || !values || typeof values !== 'object') {
    return;
  }
  if (!this.lastRawValues) {
    this.lastRawValues = {};
  }
  if (!this.lastRawValues[topic]) {
    this.lastRawValues[topic] = { dps: {}, codes: {} };
  }
  const bucket = this.lastRawValues[topic][keyKind === 'dps' ? 'dps' : 'codes'];
  const at = new Date().toISOString();
  Object.keys(values).forEach((key) => {
    bucket[String(key)] = { value: truncateRawValue(values[key]), origin, at };
  });
}

/**
 * @description Return the remembered raw values of a device.
 * @param {string} topic - The Tuya device id.
 * @returns {object} { dps: {...}, codes: {...} } (empty maps when nothing was seen yet).
 * @example
 * const { dps, codes } = this.getRawValues('device-id');
 */
function getRawValues(topic) {
  return (this.lastRawValues && this.lastRawValues[topic]) || { dps: {}, codes: {} };
}

module.exports = {
  DIAGNOSTICS_MAX_ENTRIES,
  DIAGNOSTICS_MAX_DATA_LENGTH,
  RAW_VALUE_MAX_LENGTH,
  recordDiagnostic,
  getDiagnostics,
  recordRawValues,
  getRawValues,
};
