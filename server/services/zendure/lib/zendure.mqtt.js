const logger = require('../../../utils/logger');
const { EVENTS } = require('../../../utils/constants');
const { METRIC_PATHS_BY_KEY } = require('./device/zendure.deviceMapping');

/**
 * @description Normalize MQTT URL to a format supported by mqtt.js.
 * @param {string} url - Raw URL from Zendure API.
 * @returns {string|null} Normalized URL.
 * @example
 * normalizeMqttUrl('broker.example.com:1883');
 */
function normalizeMqttUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  if (url.startsWith('mqtt://') || url.startsWith('mqtts://') || url.startsWith('ws://') || url.startsWith('wss://')) {
    return url;
  }

  return `mqtt://${url}`;
}

/**
 * @description Extract device key from MQTT topic.
 * @param {string} topic - MQTT topic.
 * @returns {string|null} Device key.
 * @example
 * extractDeviceKeyFromTopic('iot/product/device/properties/report');
 */
function extractDeviceKeyFromTopic(topic) {
  if (!topic || typeof topic !== 'string') {
    return null;
  }

  const parts = topic.split('/');
  if (parts.length < 4) {
    return null;
  }

  if (parts[0] === 'iot') {
    return parts[2] || null;
  }

  if (parts[0] === '') {
    return parts[2] || null;
  }

  return null;
}

/**
 * @description Build canonical Zendure external id from raw cloud device.
 * @param {object} rawCloudDevice - Device from cloud deviceList.
 * @returns {string|null} External id.
 * @example
 * getExternalIdFromRawCloudDevice({ deviceKey: 'abc' });
 */
function getExternalIdFromRawCloudDevice(rawCloudDevice) {
  if (!rawCloudDevice || typeof rawCloudDevice !== 'object') {
    return null;
  }
  const deviceKey = rawCloudDevice.deviceKey || rawCloudDevice.id;
  if (!deviceKey) {
    return null;
  }
  return `zendure:${deviceKey}`;
}

/**
 * @description Find a cloud device by key (case-insensitive).
 * @param {string} deviceKey - Device key from MQTT topic.
 * @returns {object|null} Raw cloud device or null.
 * @example
 * findCloudDeviceByKey('dCLTD95V');
 */
function findCloudDeviceByKey(deviceKey) {
  if (!this.cloudData || !Array.isArray(this.cloudData.deviceList)) {
    return null;
  }

  const normalizedDeviceKey = String(deviceKey || '').toLowerCase();
  return (
    this.cloudData.deviceList.find((rawCloudDevice) => {
      const rawKey = String(rawCloudDevice.deviceKey || rawCloudDevice.id || '').toLowerCase();
      return rawKey === normalizedDeviceKey;
    }) || null
  );
}

/**
 * @description Read nested value from object with a dot path.
 * @param {object} object - Object to parse.
 * @param {string} path - Dot path.
 * @returns {any} Found value or undefined.
 * @example
 * getByPath({ a: { b: 1 } }, 'a.b');
 */
function getByPath(object, path) {
  return path.split('.').reduce((accumulator, key) => {
    if (accumulator && accumulator[key] !== undefined) {
      return accumulator[key];
    }
    return undefined;
  }, object);
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
 * @description Extract normalized number from payload by possible key paths.
 * @param {object} payload - Raw MQTT payload.
 * @param {string[]} metricPaths - Candidate paths.
 * @returns {number|null} Metric value.
 * @example
 * extractMetricValue(payload, ['properties.electricLevel']);
 */
function extractMetricValue(payload, metricPaths) {
  for (let i = 0; i < metricPaths.length; i += 1) {
    const rawValue = getByPath(payload, metricPaths[i]);
    const numericValue = toNumber(rawValue);
    if (numericValue !== null) {
      return numericValue;
    }
  }
  return null;
}

/**
 * @description Normalize one metric value to final Gladys integer/percent shape.
 * @param {string} metricKey - Metric key.
 * @param {number} value - Raw value.
 * @returns {number} Normalized value.
 * @example
 * normalizeMetricValue('batteryLevel', 42.2);
 */
function normalizeMetricValue(metricKey, value) {
  if (metricKey === 'batteryLevel') {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  return Math.max(0, Math.round(value));
}

/**
 * @description Emit Gladys states from one merged MQTT payload.
 * @param {string} deviceKey - Device key from topic.
 * @param {object} payload - Merged MQTT payload.
 * @returns {void}
 * @example
 * emitStatesFromMqttPayload('dCLTD95V', payload);
 */
function emitStatesFromMqttPayload(deviceKey, payload) {
  const rawCloudDevice = findCloudDeviceByKey.call(this, deviceKey);
  if (!rawCloudDevice) {
    return;
  }

  const externalId = getExternalIdFromRawCloudDevice(rawCloudDevice);
  if (!externalId) {
    return;
  }

  const device = this.gladys.stateManager.get('deviceByExternalId', externalId);
  if (!device || !Array.isArray(device.features) || device.features.length === 0) {
    return;
  }

  (device.features || []).forEach((feature) => {
    const metricKey = String(feature.external_id || '').split(':').pop();
    const metricPaths = METRIC_PATHS_BY_KEY[metricKey];
    if (!metricPaths) {
      return;
    }

    const rawMetricValue = extractMetricValue(payload, metricPaths);
    if (rawMetricValue === null) {
      return;
    }

    const nextValue = normalizeMetricValue(metricKey, rawMetricValue);
    const hasPreviousValue =
      feature.last_value !== undefined && feature.last_value !== null && feature.last_value !== '';
    const previousAsNumber = Number(feature.last_value);
    const sameValue =
      hasPreviousValue &&
      (feature.last_value === nextValue ||
        (Number.isFinite(previousAsNumber) && Number(previousAsNumber) === nextValue));

    if (!sameValue) {
      this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
        device_feature_external_id: feature.external_id,
        state: nextValue,
      });
    }
  });
}

/**
 * @description Merge MQTT payloads because some reports only contain partial properties.
 * @param {object} previousPayload - Previous payload in cache.
 * @param {object} incomingPayload - Incoming payload.
 * @returns {object} Merged payload.
 * @example
 * mergeMqttPayload({ properties: { electricLevel: 50 } }, { properties: { packNum: 1 } });
 */
function mergeMqttPayload(previousPayload, incomingPayload) {
  const basePayload = previousPayload && typeof previousPayload === 'object' ? previousPayload : {};
  const payload = incomingPayload && typeof incomingPayload === 'object' ? incomingPayload : {};

  const mergedPayload = {
    ...basePayload,
    ...payload,
  };

  const previousProperties = basePayload.properties && typeof basePayload.properties === 'object' ? basePayload.properties : {};
  const incomingProperties = payload.properties && typeof payload.properties === 'object' ? payload.properties : {};
  const hasProperties = Object.keys(previousProperties).length > 0 || Object.keys(incomingProperties).length > 0;
  if (hasProperties) {
    mergedPayload.properties = {
      ...previousProperties,
      ...incomingProperties,
    };
  }

  return mergedPayload;
}

/**
 * @description Check if a cloud device is already created in Gladys.
 * @param {object} rawCloudDevice - Device from cloud deviceList.
 * @returns {boolean} True if device exists in Gladys.
 * @example
 * isCloudDeviceCreatedInGladys({ deviceKey: 'abc' });
 */
function isCloudDeviceCreatedInGladys(rawCloudDevice) {
  const externalId = getExternalIdFromRawCloudDevice(rawCloudDevice);
  if (!externalId) {
    return false;
  }

  const device = this.gladys.stateManager.get('deviceByExternalId', externalId);
  return Boolean(device);
}

/**
 * @description Subscribe MQTT topics for one raw cloud device.
 * @param {object} rawCloudDevice - Device from cloud deviceList.
 * @returns {void}
 * @example
 * subscribeToCloudDeviceTopics({ productKey: 'p', deviceKey: 'd' });
 */
function subscribeToCloudDeviceTopics(rawCloudDevice) {
  if (!this.mqttClient || !this.mqttConnected || !rawCloudDevice) {
    return;
  }

  const { productKey } = rawCloudDevice;
  const deviceKey = rawCloudDevice.deviceKey || rawCloudDevice.id;
  if (!productKey || !deviceKey) {
    return;
  }

  [`iot/${productKey}/${deviceKey}/#`, `/${productKey}/${deviceKey}/#`].forEach((topic) => {
    if (this.mqttSubscribedTopics.has(topic)) {
      return;
    }

    this.mqttClient.subscribe(topic, (error) => {
      if (error) {
        logger.warn(`Zendure MQTT subscribe failed for topic "${topic}": ${error.message}`);
        return;
      }

      this.mqttSubscribedTopics.add(topic);
      logger.debug(`Zendure MQTT subscribed to ${topic}.`);
    });
  });
}

/**
 * @description Handle one MQTT message and cache latest payload per device.
 * @param {string} topic - MQTT topic.
 * @param {Buffer|string} payload - MQTT payload.
 * @returns {void}
 * @example
 * handleMqttMessage('iot/a/b/properties/report', '{"properties":{"electricLevel":55}}');
 */
function handleMqttMessage(topic, payload) {
  const deviceKey = extractDeviceKeyFromTopic(topic);
  if (!deviceKey) {
    return;
  }

  let decodedPayload;
  try {
    decodedPayload = JSON.parse(payload.toString());
  } catch (e) {
    logger.debug(`Zendure MQTT message ignored (invalid JSON) topic=${topic}.`);
    return;
  }

  if (!decodedPayload || decodedPayload.isHA) {
    return;
  }

  const normalizedDeviceKey = String(deviceKey).toLowerCase();
  const previousPayload = this.latestMqttPayloadByDeviceKey.get(normalizedDeviceKey);
  const mergedPayload = mergeMqttPayload(previousPayload, decodedPayload);
  this.latestMqttPayloadByDeviceKey.set(normalizedDeviceKey, mergedPayload);
  this.lastMqttPayloadAtByDeviceKey.set(normalizedDeviceKey, Date.now());
  emitStatesFromMqttPayload.call(this, deviceKey, mergedPayload);

  if (topic.endsWith('/properties/report') || topic.endsWith('/properties/read/reply')) {
    const propertyKeys = mergedPayload.properties && typeof mergedPayload.properties === 'object'
      ? Object.keys(mergedPayload.properties)
      : [];
    logger.debug(
      `Zendure MQTT state received for ${normalizedDeviceKey} on ${topic}, properties=[${propertyKeys.join(', ')}].`,
    );
  }
}

/**
 * @description Connect to Zendure MQTT broker from cloud metadata.
 * @param {object} mqttConfiguration - MQTT config returned by Zendure API.
 * @returns {Promise<void>} Resolve when MQTT client is connected.
 * @example
 * await ensureCloudMqttConnection({ url: 'broker:1883', username: 'u', password: 'p' });
 */
async function ensureCloudMqttConnection(mqttConfiguration) {
  if (!mqttConfiguration || typeof mqttConfiguration !== 'object') {
    logger.warn('Zendure MQTT configuration is missing in cloud response.');
    return;
  }

  if (!this.mqttLibrary || typeof this.mqttLibrary.connect !== 'function') {
    logger.warn('Zendure MQTT library is not available.');
    return;
  }

  const mqttUrl = normalizeMqttUrl(mqttConfiguration.url);
  if (!mqttUrl) {
    logger.warn('Zendure MQTT URL is missing in cloud response.');
    return;
  }

  const { mqttClientId } = this;
  const mqttConnectionSignature = `${mqttUrl}::${mqttConfiguration.username || ''}::${mqttConfiguration.password || ''}`;
  if (this.mqttClient && this.mqttConnectionSignature === mqttConnectionSignature) {
    if (this.mqttConnected) {
      this.refreshMqttSubscriptions();
    }
    return;
  }

  if (this.mqttClient) {
    try {
      this.mqttClient.removeAllListeners();
      this.mqttClient.end(true);
    } catch (e) {
      logger.debug('Zendure MQTT client cleanup failed.', e);
    } finally {
      this.mqttClient = null;
      this.mqttConnected = false;
      this.mqttSubscribedTopics.clear();
    }
  }

  logger.debug(`Zendure MQTT connecting to ${mqttUrl}...`);

  const mqttClient = this.mqttLibrary.connect(mqttUrl, {
    clientId: mqttClientId,
    username: mqttConfiguration.username,
    password: mqttConfiguration.password,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    clean: true,
  });

  this.mqttClient = mqttClient;
  this.mqttConnectionSignature = mqttConnectionSignature;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Zendure MQTT connection timeout.'));
    }, 12000);

    const onConnected = () => {
      clearTimeout(timeout);
      this.mqttConnected = true;
      logger.debug('Zendure MQTT connected.');
      resolve();
    };

    const onErrorBeforeConnect = (error) => {
      clearTimeout(timeout);
      reject(error);
    };

    mqttClient.once('connect', onConnected);
    mqttClient.once('error', onErrorBeforeConnect);
  }).catch((e) => {
    this.mqttConnected = false;
    logger.warn(`Zendure MQTT initial connection failed: ${e.message}`);
  });

  mqttClient.on('connect', () => {
    this.mqttConnected = true;
    logger.debug('Zendure MQTT connection ready.');
    this.refreshMqttSubscriptions();
  });

  mqttClient.on('offline', () => {
    this.mqttConnected = false;
    logger.debug('Zendure MQTT client is offline, waiting for automatic reconnect.');
  });

  mqttClient.on('close', () => {
    this.mqttConnected = false;
  });

  mqttClient.on('error', (error) => {
    logger.warn(`Zendure MQTT error: ${error.message}`);
  });

  mqttClient.on('message', (topic, payload) => {
    handleMqttMessage.call(this, topic, payload);
  });

  if (this.mqttConnected) {
    this.refreshMqttSubscriptions();
  }
}

/**
 * @description Subscribe MQTT topics for all known cloud devices.
 * @returns {void}
 * @example
 * refreshMqttSubscriptions();
 */
function refreshMqttSubscriptions() {
  if (!this.mqttClient || !this.mqttConnected || !this.cloudData || !Array.isArray(this.cloudData.deviceList)) {
    return;
  }

  this.cloudData.deviceList.forEach((rawCloudDevice) => {
    if (!isCloudDeviceCreatedInGladys.call(this, rawCloudDevice)) {
      return;
    }
    subscribeToCloudDeviceTopics.call(this, rawCloudDevice);
  });
}

/**
 * @description Ask Zendure cloud MQTT for fresh properties of one device.
 * @param {object} rawCloudDevice - Device from cloud deviceList.
 * @returns {boolean} True if publish was attempted.
 * @example
 * requestMqttDeviceProperties({ deviceKey: 'abc', productKey: 'prod' });
 */
function requestMqttDeviceProperties(rawCloudDevice) {
  if (!this.mqttClient || !this.mqttConnected || !rawCloudDevice) {
    return false;
  }

  subscribeToCloudDeviceTopics.call(this, rawCloudDevice);

  const { productKey } = rawCloudDevice;
  const deviceKey = rawCloudDevice.deviceKey || rawCloudDevice.id;
  if (!deviceKey || !productKey) {
    return false;
  }

  const requestTopic = `iot/${productKey}/${deviceKey}/properties/read`;
  this.mqttMessageId = (this.mqttMessageId + 1) % 1000000;
  const payload = {
    deviceId: deviceKey,
    messageId: this.mqttMessageId,
    timestamp: Math.floor(Date.now() / 1000),
    properties: ['getAll'],
  };

  this.mqttClient.publish(requestTopic, JSON.stringify(payload), (error) => {
    if (error) {
      logger.warn(`Zendure MQTT read request failed for ${deviceKey}: ${error.message}`);
    }
  });

  logger.debug(`Zendure MQTT read request sent for ${deviceKey}.`);
  return true;
}

/**
 * @description Return latest MQTT payload for one Zendure device.
 * @param {string} deviceKey - Zendure device key.
 * @returns {object|null} Last payload or null.
 * @example
 * getLatestMqttPayload('abc123');
 */
function getLatestMqttPayload(deviceKey) {
  if (!deviceKey) {
    return null;
  }

  return this.latestMqttPayloadByDeviceKey.get(String(deviceKey).toLowerCase()) || null;
}

/**
 * @description Disconnect MQTT client and clear runtime cache.
 * @returns {void}
 * @example
 * disconnectMqtt();
 */
function disconnectMqtt() {
  if (this.mqttClient) {
    try {
      this.mqttClient.removeAllListeners();
      this.mqttClient.end(true);
    } catch (e) {
      logger.debug('Zendure MQTT disconnection raised an error.', e);
    }
  }

  this.mqttClient = null;
  this.mqttConnected = false;
  this.mqttConnectionSignature = null;
  this.mqttSubscribedTopics.clear();
  this.latestMqttPayloadByDeviceKey.clear();
  this.lastMqttPayloadAtByDeviceKey.clear();
}

module.exports = {
  ensureCloudMqttConnection,
  refreshMqttSubscriptions,
  requestMqttDeviceProperties,
  getLatestMqttPayload,
  disconnectMqtt,
};
