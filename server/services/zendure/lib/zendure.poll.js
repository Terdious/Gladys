const logger = require('../../../utils/logger');
const { BadParameters } = require('../../../utils/coreErrors');
const { EVENTS } = require('../../../utils/constants');
const { METRIC_PATHS_BY_KEY } = require('./device/zendure.deviceMapping');

const { STATUS } = require('./utils/zendure.constants');

const MQTT_READ_REQUEST_STALE_TIMEOUT_IN_MS = 90 * 1000;

/**
 * @description Read nested value from object with a dot path.
 * @param {object} object - Object to parse.
 * @param {string} path - Dot path.
 * @returns {any} Found value or undefined.
 * @example
 * getByPath({ a: { b: 1 } }, 'a.b');
 */
function getByPath(object, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), object);
}

/**
 * @description Convert any metric value to finite number.
 * @param {any} value - Value to normalize.
 * @returns {number|null} Finite number or null.
 * @example
 * toNumber('42');
 */
function toNumber(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }
  return null;
}

/**
 * @description Safely stringify a payload for debug logs with max length.
 * @param {any} value - Value to stringify.
 * @param {number} maxLength - Max output length.
 * @returns {string} Stringified value.
 * @example
 * safeDebugStringify({ a: 1 }, 1200);
 */
function safeDebugStringify(value, maxLength = 3000) {
  try {
    const stringified = JSON.stringify(value);
    if (stringified.length <= maxLength) {
      return stringified;
    }
    return `${stringified.slice(0, maxLength)}...<truncated>`;
  } catch (e) {
    return '[unserializable payload]';
  }
}

/**
 * @description Extract normalized number from raw device by possible key paths.
 * @param {object} rawDevice - Raw Zendure cloud device.
 * @param {string[]} metricPaths - Candidate paths.
 * @returns {number|null} Metric value.
 * @example
 * extractMetricValue(device, ['electricLevel']);
 */
function extractMetricValue(rawDevice, metricPaths) {
  for (let i = 0; i < metricPaths.length; i += 1) {
    const rawValue = getByPath(rawDevice, metricPaths[i]);
    const numericValue = toNumber(rawValue);
    if (numericValue !== null) {
      return numericValue;
    }
  }
  return null;
}

/**
 * @description Recursively search numeric value by key names.
 * @param {object|Array} input - Object/array to parse.
 * @param {string[]} keys - Candidate keys.
 * @returns {number|null} Found value.
 * @example
 * findNumericValueByKeyRecursive(device, ['electricLevel']);
 */
function findNumericValueByKeyRecursive(input, keys) {
  if (input === null || input === undefined) {
    return null;
  }

  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i += 1) {
      const value = findNumericValueByKeyRecursive(input[i], keys);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  if (typeof input !== 'object') {
    return null;
  }

  const loweredKeys = keys.map((key) => key.toLowerCase());
  const entries = Object.entries(input);

  for (let i = 0; i < entries.length; i += 1) {
    const [entryKey, entryValue] = entries[i];
    if (loweredKeys.includes(entryKey.toLowerCase())) {
      const value = toNumber(entryValue);
      if (value !== null) {
        return value;
      }
    }

    if (typeof entryValue === 'string' && (entryValue.startsWith('{') || entryValue.startsWith('['))) {
      try {
        const parsedValue = JSON.parse(entryValue);
        const parsedResult = findNumericValueByKeyRecursive(parsedValue, keys);
        if (parsedResult !== null) {
          return parsedResult;
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  for (let i = 0; i < entries.length; i += 1) {
    const nestedResult = findNumericValueByKeyRecursive(entries[i][1], keys);
    if (nestedResult !== null) {
      return nestedResult;
    }
  }

  return null;
}

/**
 * @description Suspend polling for one device until next successful cloud connection.
 * @param {object} device - Device to suspend.
 * @returns {void}
 * @example
 * suspendPollingForDevice(device);
 */
function suspendPollingForDevice(device) {
  if (!device || !device.selector || !device.poll_frequency) {
    return;
  }

  const deviceManager = this.gladys.device;
  const { poll_frequency: pollFrequency } = device;

  if (!deviceManager.devicesByPollFrequency[pollFrequency]) {
    return;
  }

  const deviceIndex = deviceManager.devicesByPollFrequency[pollFrequency].findIndex(
    (existingDevice) => existingDevice.selector === device.selector,
  );
  if (deviceIndex !== -1) {
    deviceManager.devicesByPollFrequency[pollFrequency].splice(deviceIndex, 1);
    logger.warn(`Suspended Zendure polling for ${device.selector} until cloud connection is restored.`);
  }

  if (this.suspendedPollingDeviceSelectors) {
    this.suspendedPollingDeviceSelectors.add(device.selector);
  }
}

/**
 * @description Fetch cloud devices with short in-memory cache to avoid one HTTP call per device.
 * @returns {Promise<Array>} Zendure cloud devices.
 * @example
 * await getCloudDevicesForPoll();
 */
async function getCloudDevicesForPoll() {
  if (this.pollRefreshPromise) {
    return this.pollRefreshPromise;
  }

  if (this.cloudData && Array.isArray(this.cloudData.deviceList)) {
    return this.cloudData.deviceList || [];
  }

  this.pollRefreshPromise = (async () => {
    try {
      logger.debug('Zendure poll loads cloud data because cache is empty.');
      const devices = await this.loadDevices(false);
      this.lastCloudRefreshAt = Date.now();
      return devices;
    } finally {
      this.pollRefreshPromise = null;
    }
  })();

  return this.pollRefreshPromise;
}

/**
 * @description Poll values of a Zendure device.
 * @param {object} device - Device to poll.
 * @returns {Promise<void>} Resolve when polling is complete.
 * @example
 * await poll(device);
 */
async function poll(device) {
  if (!device || !device.external_id) {
    throw new BadParameters('Zendure poll expects a device with external_id.');
  }

  const [prefix, deviceKey] = device.external_id.split(':');
  if (prefix !== 'zendure' || !deviceKey) {
    throw new BadParameters(`Zendure device external_id is invalid: "${device.external_id}"`);
  }

  if (this.status !== STATUS.CONNECTED) {
    logger.debug(`Zendure poll start for ${device.selector}: service not connected (status=${this.status}), reconnecting...`);
    try {
      await this.init();
    } catch (e) {
      suspendPollingForDevice.call(this, device);
      return;
    }
  }
  logger.debug(
    `Zendure poll start for ${device.selector}: features=${(device.features || []).length}, serviceStatus=${this.status}.`,
  );

  const cloudDevices = await getCloudDevicesForPoll.call(this);
  logger.debug(`Zendure poll cloud deviceList size=${cloudDevices.length} for ${device.selector}.`);
  const normalizedDeviceKey = String(deviceKey).toLowerCase();
  const rawCloudDevice = cloudDevices.find((cloudDevice) => {
    const cloudDeviceKey = String(cloudDevice.deviceKey || cloudDevice.id || '').toLowerCase();
    return cloudDeviceKey === normalizedDeviceKey;
  });

  if (!rawCloudDevice) {
    const knownKeys = cloudDevices
      .slice(0, 10)
      .map((cloudDevice) => cloudDevice.deviceKey || cloudDevice.id)
      .filter((key) => key)
      .join(', ');
    logger.warn(
      `Zendure raw device ${device.external_id} was not found in cloud response. Known keys sample: [${knownKeys}]`,
    );
    return;
  }

  const lastMqttPayloadAt = this.lastMqttPayloadAtByDeviceKey.get(normalizedDeviceKey);
  if (!lastMqttPayloadAt || Date.now() - lastMqttPayloadAt > MQTT_READ_REQUEST_STALE_TIMEOUT_IN_MS) {
    this.requestMqttDeviceProperties(rawCloudDevice);
  }

  const mqttPayload = this.getLatestMqttPayload(deviceKey);
  const sourcePayload = mqttPayload || rawCloudDevice;
  const payloadOrigin = mqttPayload ? 'mqtt' : 'cloud-device-list';
  logger.debug(
    `Zendure poll matched raw device for ${device.selector}: rawKey=${rawCloudDevice.deviceKey || rawCloudDevice.id}, source=${payloadOrigin}.`,
  );
  logger.debug(`Zendure poll raw payload for ${device.selector}: ${safeDebugStringify(sourcePayload)}`);
  if (!mqttPayload) {
    logger.debug(`Zendure poll has no MQTT payload yet for ${device.selector}; waiting for next MQTT report.`);
  }

  (device.features || []).forEach((feature) => {
    const metricKey = feature.external_id.split(':').pop();
    const metricPaths = METRIC_PATHS_BY_KEY[metricKey];
    if (!metricPaths) {
      logger.debug(`Zendure poll skip feature ${feature.external_id}: no metric mapping for key "${metricKey}".`);
      return;
    }

    let value = extractMetricValue(sourcePayload, metricPaths);
    if (value === null) {
      value = findNumericValueByKeyRecursive(
        sourcePayload,
        metricPaths.map((path) => path.split('.').pop()),
      );
    }
    if (value === null) {
      logger.debug(
        `Zendure poll no value for feature ${feature.external_id}, tried keys=[${metricPaths
          .map((path) => path.split('.').pop())
          .join(', ')}].`,
      );
      return;
    }

    if (metricKey === 'batteryLevel') {
      value = Math.max(0, Math.min(100, Math.round(value)));
    } else {
      value = Math.max(0, Math.round(value));
    }

    const hasPreviousValue =
      feature.last_value !== undefined && feature.last_value !== null && feature.last_value !== '';
    const lastValueAsNumber = Number(feature.last_value);
    const sameValue =
      hasPreviousValue &&
      (feature.last_value === value || (Number.isFinite(lastValueAsNumber) && Number(lastValueAsNumber) === value));
    logger.debug(
      `Zendure poll feature ${feature.external_id}: raw=${value}, previous=${feature.last_value}, changed=${!sameValue}.`,
    );

    if (!sameValue) {
      this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
        device_feature_external_id: feature.external_id,
        state: value,
      });
      logger.debug(`Zendure poll emitted state for ${feature.external_id}: ${value}.`);
    }
  });
}

module.exports = {
  poll,
};
