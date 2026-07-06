const axios = require('axios');
const logger = require('../../../utils/logger');

// Doorbell event DPs carrying a snapshot reference: the raw value is the base64 of a JSON
// { bucket, files: [[path?param=<signature>, aesKey]], v } document (observed on a real
// i5e3a4qxcsthszin doorbell — its aesKey is EMPTY, so the image is not encrypted).
const MEDIA_CODES_BY_DPS = {
  115: 'movement_detect_pic',
  154: 'doorbell_pic',
};
const MEDIA_CODES = Object.values(MEDIA_CODES_BY_DPS);

// The object-storage host is not documented for the EU datacenter (the CN docs show
// `{bucket}.cos.tuyacn.com`): try the known domains in order — every attempt is recorded in the
// diagnostics so real-life runs tell us which one answers. The signed URL (`param=`) is only
// valid for ~60 seconds after the event, so a stale cloud-poll payload can legitimately 403.
const buildMediaUrlCandidates = (bucket, filePath) => [
  `https://${bucket}.oss-eu-central-1.aliyuncs.com${filePath}`,
  `https://${bucket}.s3.eu-central-1.amazonaws.com${filePath}`,
  `https://${bucket}.cos.tuyacn.com${filePath}`,
];

const MEDIA_DOWNLOAD_TIMEOUT_MS = 10 * 1000;
// camera.setImage rejects images whose base64 string exceeds 150KB.
const MAX_IMAGE_STRING_LENGTH = 150 * 1024;

// The diagnostics collector is an optional collaborator: record only when the handler carries it.
const diag = (self, level, deviceId, event, message, data) => {
  if (typeof self.recordDiagnostic === 'function') {
    self.recordDiagnostic(level, deviceId, event, message, data);
  }
};

const getTopicFromDevice = (device) => {
  const externalId = device && device.external_id;
  const [prefix, topic] = typeof externalId === 'string' ? externalId.split(':') : [];
  return prefix === 'tuya' && topic ? topic : null;
};

/**
 * @description Decode a doorbell media payload (base64 of { bucket, files, v }).
 * @param {string} rawValue - The raw DP value pushed by the device.
 * @returns {object|null} The { bucket, filePath, encryptionKey, version } descriptor, or null when not a media payload.
 * @example
 * const media = decodeMediaPayload('eyJidWNrZXQiOiJ0eS1ldS1z...');
 */
const decodeMediaPayload = (rawValue) => {
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(rawValue, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
  const file = parsed && typeof parsed.bucket === 'string' && Array.isArray(parsed.files) ? parsed.files[0] : null;
  if (!Array.isArray(file) || typeof file[0] !== 'string' || file[0].length === 0) {
    return null;
  }
  return {
    bucket: parsed.bucket,
    filePath: file[0],
    encryptionKey: typeof file[1] === 'string' ? file[1] : '',
    version: parsed.v,
  };
};

/**
 * @description Download a doorbell snapshot and store it on the device CAMERA/IMAGE feature.
 * Never throws: every failure is recorded in the diagnostics (this runs behind poll/push).
 * @param {object} device - The Gladys device (with its camera image feature).
 * @param {string} code - The media DP code (doorbell_pic / movement_detect_pic).
 * @param {string} rawValue - The raw DP payload.
 * @returns {Promise<boolean>} True when an image was stored.
 * @example
 * await this.handleMediaValue(device, 'movement_detect_pic', rawValue);
 */
async function handleMediaValue(device, code, rawValue) {
  const topic = getTopicFromDevice(device);
  const media = decodeMediaPayload(rawValue);
  if (!media) {
    diag(this, 'debug', topic, 'media_invalid_payload', `Media payload of ${code} could not be decoded`, rawValue);
    return false;
  }
  if (media.encryptionKey !== '') {
    // Payload-driven: the observed real doorbell sends an empty key (unencrypted image). AES
    // decryption will be added once a real encrypted payload documents the IV layout.
    diag(this, 'warn', topic, 'media_encrypted_unsupported', `Encrypted ${code} image not supported yet`);
    return false;
  }

  let image = null;
  const candidates = buildMediaUrlCandidates(media.bucket, media.filePath);
  for (let i = 0; i < candidates.length && image === null; i += 1) {
    const url = candidates[i];
    const { host } = new URL(url);
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: MEDIA_DOWNLOAD_TIMEOUT_MS,
      });
      image = `image/jpg;base64,${Buffer.from(response.data).toString('base64')}`;
      diag(this, 'info', topic, 'media_download_ok', `Snapshot of ${code} downloaded from ${host}`);
    } catch (e) {
      const status = e && e.response && e.response.status ? `HTTP ${e.response.status}` : e.message;
      diag(this, 'warn', topic, 'media_download_failed', `Snapshot download failed on ${host}: ${status}`);
    }
  }
  if (image === null) {
    return false;
  }
  if (image.length > MAX_IMAGE_STRING_LENGTH) {
    diag(this, 'warn', topic, 'media_image_too_big', `Snapshot of ${code} exceeds the 150KB camera limit`);
    return false;
  }

  try {
    await this.gladys.device.camera.setImage(device.selector, image);
    diag(this, 'info', topic, 'media_stored', `Snapshot of ${code} stored on the camera feature`);
    return true;
  } catch (e) {
    logger.warn(`[Tuya][media] failed to store the ${code} snapshot for device=${topic}`, e);
    diag(this, 'warn', topic, 'media_store_failed', `Snapshot of ${code} could not be stored: ${e.message}`);
    return false;
  }
}

/**
 * @description Gate the doorbell media DPs on their RAW payload and trigger the snapshot download
 * on a NEW non-empty payload — same semantics as the ring event gate (first observation only seeds
 * the memory: the signed URL of a payload seen at startup is expired anyway).
 * @param {object} device - The Gladys device.
 * @param {object} valuesByCode - The observed raw values keyed by Tuya code.
 * @example
 * this.processMediaCodes(device, { movement_detect_pic: 'eyJi...' });
 */
function processMediaCodes(device, valuesByCode) {
  if (!device || !valuesByCode || typeof valuesByCode !== 'object') {
    return;
  }
  this.eventDpMemory = this.eventDpMemory || {};
  MEDIA_CODES.forEach((code) => {
    if (!Object.prototype.hasOwnProperty.call(valuesByCode, code)) {
      return;
    }
    const rawValue = valuesByCode[code];
    const memoryKey = `${device.external_id}:media:${code}`;
    const hadPrevious = Object.prototype.hasOwnProperty.call(this.eventDpMemory, memoryKey);
    const previousRaw = this.eventDpMemory[memoryKey];
    this.eventDpMemory[memoryKey] = rawValue;
    if (!hadPrevious || previousRaw === rawValue || !rawValue) {
      return;
    }
    // Fire and forget: the poll/push pipeline must never wait on a media download.
    (async () => {
      try {
        await this.handleMediaValue(device, code, rawValue);
      } catch (e) {
        logger.warn(`[Tuya][media] unexpected media handling error for ${code}`, e);
      }
    })();
  });
}

/**
 * @description Map a local DPS payload to media codes ({ '115': raw } -> { movement_detect_pic: raw }).
 * @param {object} dps - The local DPS map.
 * @returns {object} The media values keyed by Tuya code.
 * @example
 * const valuesByCode = mapDpsToMediaCodes({ 115: 'eyJi...' });
 */
const mapDpsToMediaCodes = (dps) => {
  const valuesByCode = {};
  if (!dps || typeof dps !== 'object') {
    return valuesByCode;
  }
  Object.keys(MEDIA_CODES_BY_DPS).forEach((dpsKey) => {
    if (
      Object.prototype.hasOwnProperty.call(dps, dpsKey) ||
      Object.prototype.hasOwnProperty.call(dps, Number(dpsKey))
    ) {
      valuesByCode[MEDIA_CODES_BY_DPS[dpsKey]] = Object.prototype.hasOwnProperty.call(dps, dpsKey)
        ? dps[dpsKey]
        : dps[Number(dpsKey)];
    }
  });
  return valuesByCode;
};

module.exports = {
  MEDIA_CODES,
  decodeMediaPayload,
  mapDpsToMediaCodes,
  handleMediaValue,
  processMediaCodes,
};
