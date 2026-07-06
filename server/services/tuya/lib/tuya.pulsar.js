const crypto = require('crypto');
const WebSocket = require('ws');
const logger = require('../../../utils/logger');
const { GLADYS_VARIABLES } = require('./utils/tuya.constants');
const { normalizeBoolean } = require('./utils/tuya.normalize');
const { emitCloudCodeStates } = require('./tuya.poll');

// Tuya Message Service (Pulsar over websocket): the cloud pushes device events in real time —
// exactly what the 30s poll cannot give us (doorbell rings, snapshot URLs still within their ~60s
// signature validity, instant state reports). OPT-IN: requires the "Message Service" to be enabled
// on the Tuya IoT project, and the TUYA_PULSAR_ENABLED variable to be truthy.
const PULSAR_HOSTS = {
  china: 'wss://mqe.tuyacn.com:8285/',
  westernAmerica: 'wss://mqe.tuyaus.com:8285/',
  easternAmerica: 'wss://mqe.tuyaus.com:8285/',
  centralEurope: 'wss://mqe.tuyaeu.com:8285/',
  westernEurope: 'wss://mqe.tuyaeu.com:8285/',
  india: 'wss://mqe.tuyain.com:8285/',
};
const PULSAR_DEFAULT_HOST = PULSAR_HOSTS.centralEurope;
// Failover subscription on the production event topic, same parameters as the official SDK.
const PULSAR_TOPIC_QUERY = 'ackTimeoutMillis=3000&subscriptionType=Failover';
const PULSAR_PING_INTERVAL_MS = 30 * 1000;
const PULSAR_RECONNECT_DELAYS_MS = [3000, 10000, 30000, 60000];
// Protocol 4 = legacy device data report ({ devId, status: [{ code, value, t }] });
// protocol 1000 = its IoT-core twin ({ bizCode: 'devicePropertyMessage', bizData }).
const PULSAR_ROUTED_PROTOCOLS = new Set([4, 1000]);

const md5Hex = (value) =>
  crypto
    .createHash('md5')
    .update(value, 'utf8')
    .digest('hex');

/**
 * @description Build the Pulsar websocket password (official SDK derivation).
 * @param {string} accessId - The Tuya cloud Access ID.
 * @param {string} accessKey - The Tuya cloud Access Secret.
 * @returns {string} The 16-character websocket password.
 * @example
 * buildPulsarPassword('accessId', 'accessKey');
 */
const buildPulsarPassword = (accessId, accessKey) => md5Hex(`${accessId}${md5Hex(accessKey)}`).substr(8, 16);

/**
 * @description Decrypt a Pulsar message data blob, keyed on a fragment of the secret. The message
 * properties carry the model in `em`: 'aes_gcm' (12-byte nonce prefix + ciphertext + 16-byte auth
 * tag, no AAD — per the official tuya-pulsar-sdk-go tyutils/aes.go) or legacy AES-128-ECB.
 * @param {string} data - The base64 encrypted data.
 * @param {string} accessKey - The Tuya cloud Access Secret.
 * @param {string} [decryptModel] - The `em` message property ('aes_gcm' or undefined for ECB).
 * @returns {object|null} The decrypted JSON document, or null when it cannot be decrypted.
 * @example
 * decryptPulsarData('kTVln...', 'accessKey', 'aes_gcm');
 */
const decryptPulsarData = (data, accessKey, decryptModel) => {
  try {
    const key = Buffer.from(accessKey.substring(8, 24), 'utf8');
    const encrypted = Buffer.from(data, 'base64');
    let decrypted;
    if (decryptModel === 'aes_gcm') {
      const decipher = crypto.createDecipheriv('aes-128-gcm', key, encrypted.subarray(0, 12));
      decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
      decrypted = Buffer.concat([decipher.update(encrypted.subarray(12, encrypted.length - 16)), decipher.final()]);
    } else {
      const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
    return JSON.parse(decrypted.toString('utf8'));
  } catch (e) {
    return null;
  }
};

// The diagnostics collector is an optional collaborator: record only when the handler carries it.
const diag = (self, level, deviceId, event, message, data) => {
  if (typeof self.recordDiagnostic === 'function') {
    self.recordDiagnostic(level, deviceId, event, message, data);
  }
};

// Every report currently arrives TWICE (legacy protocol 4 statusReport AND its IoT-core twin,
// protocol 1000 devicePropertyMessage): remember the recent ones to route each report only once.
const PULSAR_DUPLICATE_WINDOW_MS = 5 * 1000;

const routePulsarValues = (self, devId, values) => {
  const now = Date.now();
  self.pulsarRecentReports = self.pulsarRecentReports || new Map();
  const duplicateKey = `${devId}:${JSON.stringify(values)}`;
  const lastSeenAt = self.pulsarRecentReports.get(duplicateKey);
  self.pulsarRecentReports.forEach((seenAt, key) => {
    if (now - seenAt > PULSAR_DUPLICATE_WINDOW_MS) {
      self.pulsarRecentReports.delete(key);
    }
  });
  self.pulsarRecentReports.set(duplicateKey, now);
  if (lastSeenAt !== undefined && now - lastSeenAt <= PULSAR_DUPLICATE_WINDOW_MS) {
    diag(self, 'debug', devId, 'pulsar_duplicate_skipped', 'Twin-format Pulsar report already routed');
    return;
  }
  diag(self, 'debug', devId, 'pulsar_report', `Pulsar real-time report (${Object.keys(values).join(', ')})`, values);

  const device = self.gladys.stateManager.get('deviceByExternalId', `tuya:${devId}`);
  if (!device) {
    diag(self, 'debug', devId, 'pulsar_unknown_device', 'Pulsar report for a device not in Gladys');
    return;
  }
  if (typeof self.recordRawValues === 'function') {
    self.recordRawValues(devId, 'pulsar', values, 'codes');
  }
  if (typeof self.processMediaCodes === 'function') {
    // The whole point for the doorbell: the snapshot URL arrives while its signature is fresh.
    self.processMediaCodes(device, values);
  }
  self.eventDpMemory = self.eventDpMemory || {};
  emitCloudCodeStates(self.gladys, device, values, self.eventDpMemory);
};

/**
 * @description Handle one decrypted Pulsar event: route data reports into the exact pipelines the
 * poll uses (raw-value memory, media snapshots, feature states with the shared event gate).
 * @param {object} decrypted - The decrypted Pulsar document.
 * @example
 * this.handlePulsarEvent({ devId: 'device-id', status: [{ code: 'switch_1', value: true }] });
 */
function handlePulsarEvent(decrypted) {
  // IoT-core format (protocol 1000): { bizCode: 'devicePropertyMessage', bizData: { devId,
  // properties: [{ code, value, ... }] } } — same content as the legacy status report.
  if (decrypted && decrypted.bizCode === 'devicePropertyMessage' && decrypted.bizData) {
    const propertyList = Array.isArray(decrypted.bizData.properties) ? decrypted.bizData.properties : [];
    const values = {};
    propertyList.forEach((entry) => {
      if (entry && entry.code !== undefined && entry.code !== null) {
        values[String(entry.code)] = entry.value;
      }
    });
    if (!decrypted.bizData.devId || Object.keys(values).length === 0) {
      diag(this, 'debug', decrypted.bizData.devId || null, 'pulsar_event_skipped', 'Empty property message', decrypted);
      return;
    }
    routePulsarValues(this, decrypted.bizData.devId, values);
    return;
  }
  const devId = decrypted && (decrypted.devId || decrypted.deviceId);
  if (!devId) {
    diag(this, 'debug', null, 'pulsar_event_skipped', 'Pulsar event without device id', decrypted);
    return;
  }
  if (decrypted.bizCode) {
    // Lifecycle events (online/offline/name change...): informational for now.
    diag(this, 'debug', devId, 'pulsar_biz_event', `Pulsar event ${decrypted.bizCode}`, decrypted.bizData);
    return;
  }
  const statusList = Array.isArray(decrypted.status) ? decrypted.status : [];
  const values = {};
  statusList.forEach((entry) => {
    if (entry && entry.code !== undefined && entry.code !== null) {
      values[String(entry.code)] = entry.value;
    }
  });
  if (Object.keys(values).length === 0) {
    diag(this, 'debug', devId, 'pulsar_event_skipped', 'Pulsar report without status values', decrypted);
    return;
  }
  routePulsarValues(this, devId, values);
}

/**
 * @description Start the Pulsar listener when enabled and configured. Never throws.
 * @returns {Promise} Resolves once the connection has been kicked off (or skipped).
 * @example
 * await this.startPulsar();
 */
async function startPulsar() {
  try {
    const enabledRaw = await this.gladys.variable.getValue(GLADYS_VARIABLES.PULSAR_ENABLED, this.serviceId);
    const enabled = normalizeBoolean(enabledRaw);
    if (!enabled) {
      this.pulsar = { status: 'disabled' };
      logger.debug('[Tuya][pulsar] disabled (TUYA_PULSAR_ENABLED is not set)');
      return;
    }
    const endpoint = await this.gladys.variable.getValue(GLADYS_VARIABLES.ENDPOINT, this.serviceId);
    const accessId = await this.gladys.variable.getValue(GLADYS_VARIABLES.ACCESS_KEY, this.serviceId);
    const accessKey = await this.gladys.variable.getValue(GLADYS_VARIABLES.SECRET_KEY, this.serviceId);
    if (!accessId || !accessKey) {
      this.pulsar = { status: 'not_configured' };
      diag(this, 'warn', null, 'pulsar_not_configured', 'Pulsar enabled but the cloud credentials are missing');
      return;
    }
    const host = PULSAR_HOSTS[endpoint] || PULSAR_DEFAULT_HOST;
    // eslint-disable-next-line no-use-before-define
    openPulsarConnection(this, { host, accessId, accessKey, retryCount: 0 });
  } catch (e) {
    logger.warn(`[Tuya][pulsar] failed to start: ${e.message}`);
    this.pulsar = { status: 'error' };
  }
}

/**
 * @description Open (or reopen) the Pulsar websocket and wire its listeners.
 * @param {object} self - The TuyaHandler instance.
 * @param {object} context - The { host, accessId, accessKey, retryCount } connection context.
 * @example
 * openPulsarConnection(this, { host, accessId, accessKey, retryCount: 0 });
 */
function openPulsarConnection(self, context) {
  const { host, accessId, accessKey } = context;
  const url = `${host}ws/v2/consumer/persistent/${accessId}/out/event/${accessId}-sub?${PULSAR_TOPIC_QUERY}`;
  const ws = new WebSocket(url, {
    headers: {
      username: accessId,
      password: buildPulsarPassword(accessId, accessKey),
    },
  });
  const entry = { status: 'connecting', ws, pingTimer: null, retryTimer: null, context };
  self.pulsar = entry;
  const isActive = () => self.pulsar === entry;

  // Only called from the 'close' listener, which already checks isActive().
  const scheduleReconnect = () => {
    entry.status = 'reconnecting';
    const delay = PULSAR_RECONNECT_DELAYS_MS[Math.min(context.retryCount, PULSAR_RECONNECT_DELAYS_MS.length - 1)];
    context.retryCount += 1;
    entry.retryTimer = setTimeout(() => {
      openPulsarConnection(self, context);
    }, delay);
    if (entry.retryTimer && typeof entry.retryTimer.unref === 'function') {
      entry.retryTimer.unref();
    }
  };

  ws.on('open', () => {
    if (!isActive()) {
      return;
    }
    entry.status = 'connected';
    context.retryCount = 0;
    logger.info('[Tuya][pulsar] connected to the Tuya message service');
    diag(self, 'info', null, 'pulsar_connected', 'Pulsar connected: real-time cloud events active');
    entry.pingTimer = setInterval(() => {
      try {
        ws.ping();
      } catch (e) {
        logger.debug(`[Tuya][pulsar] ping failed: ${e.message}`);
      }
    }, PULSAR_PING_INTERVAL_MS);
    if (typeof entry.pingTimer.unref === 'function') {
      entry.pingTimer.unref();
    }
  });

  ws.on('message', (raw) => {
    if (!isActive()) {
      return;
    }
    let envelope;
    try {
      envelope = JSON.parse(raw.toString());
    } catch (e) {
      diag(self, 'warn', null, 'pulsar_bad_message', `Unparseable Pulsar frame: ${e.message}`, raw.toString());
      return;
    }
    // Acknowledge first: an unacked message is redelivered after ackTimeoutMillis.
    if (envelope && envelope.messageId) {
      try {
        ws.send(JSON.stringify({ messageId: envelope.messageId }));
      } catch (e) {
        logger.debug(`[Tuya][pulsar] ack failed: ${e.message}`);
      }
    }
    if (!envelope || !envelope.payload) {
      return;
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
    } catch (e) {
      diag(self, 'warn', null, 'pulsar_bad_message', `Unparseable Pulsar payload: ${e.message}`, envelope);
      return;
    }
    // The `em` message property selects the encryption model of the data blob (aes_gcm or ECB).
    const decryptModel = envelope.properties && envelope.properties.em;
    if (payload.protocol !== undefined && !PULSAR_ROUTED_PROTOCOLS.has(payload.protocol)) {
      // Test-phase visibility: keep the decrypted content (or the raw payload) in the diagnostics
      // so an unknown protocol is immediately understandable.
      diag(self, 'debug', null, 'pulsar_other_protocol', `Pulsar message with protocol ${payload.protocol}`, {
        properties: envelope.properties,
        payload,
        decrypted: decryptPulsarData(payload.data, accessKey, decryptModel),
      });
      return;
    }
    const decrypted = decryptPulsarData(payload.data, accessKey, decryptModel);
    if (!decrypted) {
      diag(self, 'warn', null, 'pulsar_decrypt_failed', 'Pulsar message could not be decrypted', {
        properties: envelope.properties,
        payload,
      });
      return;
    }
    self.handlePulsarEvent(decrypted);
  });

  ws.on('error', (e) => {
    if (!isActive()) {
      return;
    }
    if (String(e.message).includes('401')) {
      // The message service refused our credentials: retrying cannot fix it — "Message Service"
      // is most likely not enabled on the Tuya IoT project. Stop here with an explicit status.
      entry.unauthorized = true;
      logger.warn('[Tuya][pulsar] rejected by the Tuya message service (401)');
      diag(
        self,
        'error',
        null,
        'pulsar_unauthorized',
        'Pulsar rejected (HTTP 401): enable "Message Service" on your Tuya IoT project (https://iot.tuya.com/cloud/ > your project > Service API), then save the Tuya configuration again',
      );
      return;
    }
    logger.info(`[Tuya][pulsar] websocket error: ${e.message}`);
    diag(self, 'warn', null, 'pulsar_error', `Pulsar websocket error: ${e.message}`);
  });

  ws.on('close', () => {
    if (!isActive()) {
      return;
    }
    if (entry.pingTimer) {
      clearInterval(entry.pingTimer);
      entry.pingTimer = null;
    }
    if (entry.unauthorized) {
      entry.status = 'unauthorized';
      return;
    }
    diag(self, 'warn', null, 'pulsar_disconnected', 'Pulsar connection closed, reconnecting');
    scheduleReconnect();
  });
}

/**
 * @description Stop the Pulsar listener (service stop / configuration change).
 * @example
 * this.stopPulsar();
 */
function stopPulsar() {
  const entry = this.pulsar;
  this.pulsar = { status: 'stopped' };
  if (!entry) {
    return;
  }
  if (entry.pingTimer) {
    clearInterval(entry.pingTimer);
  }
  if (entry.retryTimer) {
    clearTimeout(entry.retryTimer);
  }
  if (entry.ws) {
    try {
      entry.ws.terminate();
    } catch (e) {
      // The socket is being dropped anyway.
    }
  }
}

module.exports = {
  buildPulsarPassword,
  decryptPulsarData,
  handlePulsarEvent,
  startPulsar,
  stopPulsar,
};
