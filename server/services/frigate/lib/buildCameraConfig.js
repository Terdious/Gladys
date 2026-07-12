const { BadParameters } = require('../../../utils/coreErrors');
const { CAMERA_PARAMS, SOURCE_TYPES, TRACKABLE_LABELS, DEFAULT } = require('./constants');

/**
 * @description Get a device param value.
 * @param {object} device - Gladys device.
 * @param {string} paramName - Name of the param.
 * @returns {string} The param value, or null.
 * @example
 * getDeviceParam(device, 'FRIGATE_SOURCE_TYPE');
 */
function getDeviceParam(device, paramName) {
  const param = (device.params || []).find(({ name }) => name === paramName);
  return param ? param.value : null;
}

/**
 * @description Build the go2rtc source string of a camera device. Credentials
 * are URL-encoded here: the user types them in clear text in the UI.
 * @param {object} device - Gladys camera device.
 * @returns {string} The go2rtc source.
 * @example
 * buildGo2rtcSource(device);
 */
function buildGo2rtcSource(device) {
  const sourceType = getDeviceParam(device, CAMERA_PARAMS.SOURCE_TYPE);
  const host = getDeviceParam(device, CAMERA_PARAMS.SOURCE_HOST);
  const username = getDeviceParam(device, CAMERA_PARAMS.SOURCE_USERNAME);
  const password = getDeviceParam(device, CAMERA_PARAMS.SOURCE_PASSWORD);

  switch (sourceType) {
    case SOURCE_TYPES.RTSP: {
      if (!host) {
        throw new BadParameters(`Frigate: camera ${device.external_id} has no host configured`);
      }
      const path = getDeviceParam(device, CAMERA_PARAMS.SOURCE_PATH);
      const credentials = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password || '')}@` : '';
      const cleanPath = path ? `/${path.replace(/^\//, '')}` : '';
      return `rtsp://${credentials}${host}:${DEFAULT.RTSP_PORT}${cleanPath}`;
    }
    case SOURCE_TYPES.TAPO: {
      if (!host) {
        throw new BadParameters(`Frigate: camera ${device.external_id} has no host configured`);
      }
      const extra = getDeviceParam(device, CAMERA_PARAMS.SOURCE_EXTRA) || DEFAULT.TAPO_SOURCE_EXTRA;
      return `tapo://${encodeURIComponent(password || '')}@${host}?${extra}`;
    }
    case SOURCE_TYPES.CUSTOM: {
      const customSource = getDeviceParam(device, CAMERA_PARAMS.CUSTOM_SOURCE);
      if (!customSource) {
        throw new BadParameters(`Frigate: camera ${device.external_id} has no custom source configured`);
      }
      return customSource;
    }
    default:
      throw new BadParameters(`Frigate: camera ${device.external_id} has an invalid source type "${sourceType}"`);
  }
}

/**
 * @description Build the go2rtc stream and Frigate camera sections of a device.
 * @param {object} device - Gladys camera device.
 * @returns {object} Camera name, go2rtc source and Frigate camera section.
 * @example
 * const { cameraName, go2rtcSource, cameraSection } = buildCameraConfig(device);
 */
function buildCameraConfig(device) {
  const [, cameraName] = device.external_id.split(':');
  if (!cameraName) {
    throw new BadParameters(`Frigate: device ${device.external_id} has an invalid external id`);
  }

  const sourceType = getDeviceParam(device, CAMERA_PARAMS.SOURCE_TYPE);
  const go2rtcSource = buildGo2rtcSource(device);

  const trackedLabelsRaw = getDeviceParam(device, CAMERA_PARAMS.TRACKED_LABELS);
  const trackedLabels = (trackedLabelsRaw || '')
    .split(',')
    .map((label) => label.trim())
    .filter((label) => TRACKABLE_LABELS.includes(label));
  if (trackedLabels.length === 0) {
    trackedLabels.push('person');
  }

  const detectFpsRaw = Number(getDeviceParam(device, CAMERA_PARAMS.DETECT_FPS));
  const detectFps = !Number.isNaN(detectFpsRaw) && detectFpsRaw > 0 ? detectFpsRaw : DEFAULT.DETECT_FPS;

  const input = {
    // Always consume through the go2rtc restream: cameras only get one connection
    path: `rtsp://127.0.0.1:8554/${cameraName}`,
    roles: ['detect', 'record'],
  };
  if (sourceType === SOURCE_TYPES.TAPO) {
    input.input_args = DEFAULT.TAPO_INPUT_ARGS;
  }

  const detect = {
    enabled: true,
    fps: detectFps,
  };
  if (sourceType === SOURCE_TYPES.TAPO) {
    // The tapo substream does not expose its parameters fast enough for the
    // Frigate resolution probe: set the known substream dimensions explicitly
    detect.width = DEFAULT.TAPO_DETECT_WIDTH;
    detect.height = DEFAULT.TAPO_DETECT_HEIGHT;
  }

  const cameraSection = {
    ffmpeg: {
      inputs: [input],
    },
    detect,
    objects: {
      track: trackedLabels,
    },
    record: DEFAULT.RECORD_CONTENT,
    snapshots: DEFAULT.SNAPSHOTS_CONTENT,
  };

  return { cameraName, go2rtcSource, cameraSection };
}

module.exports = {
  getDeviceParam,
  buildCameraConfig,
};
