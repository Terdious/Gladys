const crypto = require('crypto');
const { request } = require('undici');

const logger = require('../../../utils/logger');
const { BadParameters, ServiceNotConfiguredError } = require('../../../utils/coreErrors');

const { API, AUTH, STATUS } = require('./utils/zendure.constants');

/**
 * @description Resume polling for Zendure devices suspended while disconnected.
 * @returns {void}
 * @example
 * resumeSuspendedPolling();
 */
function resumeSuspendedPolling() {
  if (!this.suspendedPollingDeviceSelectors || this.suspendedPollingDeviceSelectors.size === 0) {
    return;
  }

  const deviceManager = this.gladys.device;
  const selectors = [...this.suspendedPollingDeviceSelectors];

  selectors.forEach((selector) => {
    const device = this.gladys.stateManager.get('device', selector);
    if (!device || !device.should_poll || !device.poll_frequency) {
      return;
    }

    if (!deviceManager.devicesByPollFrequency[device.poll_frequency]) {
      deviceManager.devicesByPollFrequency[device.poll_frequency] = [];
    }

    const alreadyInList = deviceManager.devicesByPollFrequency[device.poll_frequency].some(
      (existingDevice) => existingDevice.selector === device.selector,
    );

    if (!alreadyInList) {
      deviceManager.devicesByPollFrequency[device.poll_frequency].push(device);
    }
  });

  this.suspendedPollingDeviceSelectors.clear();
}

/**
 * @description Decode Zendure app token and split api URL/app key.
 * @param {string} appToken - Base64 encoded token.
 * @returns {object} Decoded API URL and app key.
 * @example
 * decodeAppToken('...');
 */
function decodeAppToken(appToken) {
  const decodedToken = Buffer.from(appToken, 'base64').toString('utf8');
  if (!decodedToken || !decodedToken.includes('.')) {
    throw new BadParameters('Zendure app token format is invalid.');
  }

  const lastDot = decodedToken.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === decodedToken.length - 1) {
    throw new BadParameters('Zendure app token format is invalid.');
  }

  return {
    apiUrl: decodedToken.slice(0, lastDot),
    appKey: decodedToken.slice(lastDot + 1),
  };
}

/**
 * @description Build Zendure signed request headers.
 * @param {string} appKey - Zendure app key.
 * @returns {object} Signed headers.
 * @example
 * buildHeaders('my-app-key');
 */
function buildHeaders(appKey) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = `${Math.floor(Math.random() * 90000) + 10000}`;
  const signParams = {
    appKey,
    timestamp,
    nonce,
  };
  const bodyStr = Object.keys(signParams)
    .sort()
    .map((key) => `${key}${signParams[key]}`)
    .join('');

  const signStr = `${AUTH.SIGN_KEY}${bodyStr}${AUTH.SIGN_KEY}`;
  const sign = crypto.createHash('sha1').update(signStr, 'utf8').digest('hex').toUpperCase();

  return {
    'Content-Type': 'application/json',
    timestamp: `${timestamp}`,
    nonce,
    clientid: AUTH.CLIENT_ID,
    sign,
  };
}

/**
 * @description Connect to Zendure cloud and fetch cloud payload.
 * @param {object} configuration - Zendure configuration.
 * @returns {Promise<object>} Zendure cloud payload.
 * @example
 * await connect({ appToken: '...' });
 */
async function connect(configuration) {
  const { appToken } = configuration;
  if (!appToken || appToken.length < 5) {
    this.status = STATUS.NOT_INITIALIZED;
    throw new ServiceNotConfiguredError('Zendure is not configured.');
  }

  this.status = STATUS.CONNECTING;

  try {
    const { apiUrl, appKey } = decodeAppToken(appToken);
    const headers = buildHeaders(appKey);

    logger.debug('Connecting to Zendure cloud...');

    const { statusCode, body } = await request(`${apiUrl}${API.DEVICE_LIST}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ appKey }),
    });

    const response = await body.json();
    const deviceCount =
      response && response.data && Array.isArray(response.data.deviceList) ? response.data.deviceList.length : -1;
    const mqttKeysCount =
      response && response.data && response.data.mqtt && typeof response.data.mqtt === 'object'
        ? Object.keys(response.data.mqtt).length
        : 0;
    logger.debug(
      `Zendure cloud response: http=${statusCode}, code=${response && response.code}, success=${
        response && response.success
      }, message="${(response && (response.msg || response.message)) || ''}", deviceCount=${deviceCount}, mqttKeys=${mqttKeysCount}`,
    );

    if (statusCode >= 400) {
      throw new BadParameters(`Zendure cloud request failed (HTTP ${statusCode}).`);
    }

    if (!response || !response.success || response.code !== 200 || !response.data) {
      const cloudCode = response && response.code !== undefined ? response.code : 'unknown';
      const cloudMessage = (response && (response.msg || response.message)) || 'unknown error';
      throw new BadParameters(`Zendure cloud authentication failed (code=${cloudCode}, message=${cloudMessage}).`);
    }

    if (!Array.isArray(response.data.deviceList)) {
      throw new BadParameters('Zendure cloud response is invalid: device list is missing.');
    }
    if (response.data.deviceList.length === 0) {
      throw new BadParameters('Zendure cloud authentication failed: no device found for this token.');
    }
    if (!response.data.mqtt || Object.keys(response.data.mqtt).length === 0) {
      throw new BadParameters('Zendure cloud authentication failed: MQTT metadata is missing.');
    }

    this.cloudData = response.data;
    this.lastCloudRefreshAt = Date.now();
    await this.ensureCloudMqttConnection(response.data.mqtt);
    this.refreshMqttSubscriptions();
    this.status = STATUS.CONNECTED;
    resumeSuspendedPolling.call(this);

    return response.data;
  } catch (e) {
    if (e instanceof ServiceNotConfiguredError) {
      this.status = STATUS.NOT_INITIALIZED;
      throw e;
    }

    this.cloudData = null;
    this.disconnectMqtt();
    this.status = STATUS.ERROR;
    if (e instanceof BadParameters) {
      logger.warn(`Unable to connect to Zendure cloud: ${e.message}`);
      throw e;
    }
    logger.error('Error connecting to Zendure cloud', e);
    throw e;
  }
}

module.exports = {
  connect,
};
