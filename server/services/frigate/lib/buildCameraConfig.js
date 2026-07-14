const crypto = require('crypto');

const { BadParameters } = require('../../../utils/coreErrors');
const {
  CAMERA_PARAMS,
  SOURCE_TYPES,
  CONTROL_PROTOCOLS,
  TAPO_AUTH_VARIANTS,
  TRACKABLE_LABELS,
  DEFAULT,
} = require('./constants');

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
 * @description Build a rtsp URL with URL-encoded credentials.
 * @param {object} device - Gladys camera device.
 * @param {string} path - Stream path.
 * @returns {string} The rtsp URL.
 * @example
 * buildRtspUrl(device, 'stream1');
 */
function buildRtspUrl(device, path) {
  const host = getDeviceParam(device, CAMERA_PARAMS.SOURCE_HOST);
  const username = getDeviceParam(device, CAMERA_PARAMS.SOURCE_USERNAME);
  const password = getDeviceParam(device, CAMERA_PARAMS.SOURCE_PASSWORD);
  const port = Number(getDeviceParam(device, CAMERA_PARAMS.SOURCE_RTSP_PORT)) || DEFAULT.RTSP_PORT;
  const credentials = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password || '')}@` : '';
  const cleanPath = path ? `/${path.replace(/^\//, '')}` : '';
  // Optional go2rtc modifiers set by the camera catalog, such as
  // #video=copy#audio=aac to skip a second audio track (Opus...) that would
  // break the mp4 recordings
  const sourceFilter = getDeviceParam(device, CAMERA_PARAMS.SOURCE_FILTER) || '';
  return `rtsp://${credentials}${host}:${port}${cleanPath}${sourceFilter}`;
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
  const password = getDeviceParam(device, CAMERA_PARAMS.SOURCE_PASSWORD);

  switch (sourceType) {
    case SOURCE_TYPES.RTSP: {
      if (!host) {
        throw new BadParameters(`Frigate: camera ${device.external_id} has no host configured`);
      }
      return buildRtspUrl(device, getDeviceParam(device, CAMERA_PARAMS.SOURCE_PATH));
    }
    case SOURCE_TYPES.TAPO: {
      if (!host) {
        throw new BadParameters(`Frigate: camera ${device.external_id} has no host configured`);
      }
      const extra = getDeviceParam(device, CAMERA_PARAMS.SOURCE_EXTRA) || DEFAULT.TAPO_SOURCE_EXTRA;
      // Some recent firmwares only accept admin + uppercase SHA256 of the cloud password
      const authVariant = getDeviceParam(device, CAMERA_PARAMS.TAPO_AUTH_VARIANT);
      if (authVariant === TAPO_AUTH_VARIANTS.SHA256) {
        const passwordHash = crypto
          .createHash('sha256')
          .update(password || '')
          .digest('hex')
          .toUpperCase();
        return `tapo://admin:${passwordHash}@${host}?${extra}`;
      }
      return `tapo://${encodeURIComponent(password || '')}@${host}?${extra}`;
    }
    case SOURCE_TYPES.ONVIF: {
      if (!host) {
        throw new BadParameters(`Frigate: camera ${device.external_id} has no host configured`);
      }
      // ONVIF has its own credentials and port, kept separately so switching
      // source types never loses what the user typed
      const username = getDeviceParam(device, CAMERA_PARAMS.ONVIF_USERNAME);
      const onvifPassword = getDeviceParam(device, CAMERA_PARAMS.ONVIF_PASSWORD);
      const port = Number(getDeviceParam(device, CAMERA_PARAMS.ONVIF_PORT)) || DEFAULT.ONVIF_PORT;
      const credentials = username ? `${encodeURIComponent(username)}:${encodeURIComponent(onvifPassword || '')}@` : '';
      return `onvif://${credentials}${host}:${port}`;
    }
    case SOURCE_TYPES.MJPEG: {
      if (!host) {
        throw new BadParameters(`Frigate: camera ${device.external_id} has no host configured`);
      }
      // Old cameras without RTSP (D-Link mydlink Lite...): go2rtc reads the
      // HTTP MJPEG stream and re-encodes it to H264 (light at VGA resolutions)
      const username = getDeviceParam(device, CAMERA_PARAMS.SOURCE_USERNAME);
      const port = Number(getDeviceParam(device, CAMERA_PARAMS.SOURCE_HTTP_PORT)) || DEFAULT.HTTP_PORT;
      const path = getDeviceParam(device, CAMERA_PARAMS.SOURCE_PATH) || DEFAULT.MJPEG_PATH;
      const credentials = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password || '')}@` : '';
      const cleanPath = `/${path.replace(/^\//, '')}`;
      return `ffmpeg:http://${credentials}${host}:${port}${cleanPath}#video=h264`;
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
 * @description Build the optional secondary go2rtc source of a camera device,
 * used for detection while the main stream keeps the recording quality.
 * @param {object} device - Gladys camera device.
 * @returns {string} The secondary go2rtc source, or null.
 * @example
 * buildGo2rtcSubSource(device);
 */
function buildGo2rtcSubSource(device) {
  const sourceType = getDeviceParam(device, CAMERA_PARAMS.SOURCE_TYPE);
  if (sourceType === SOURCE_TYPES.RTSP) {
    const subPath = getDeviceParam(device, CAMERA_PARAMS.SOURCE_SUB_PATH);
    return subPath ? buildRtspUrl(device, subPath) : null;
  }
  if (sourceType === SOURCE_TYPES.CUSTOM) {
    return getDeviceParam(device, CAMERA_PARAMS.CUSTOM_SUB_SOURCE);
  }
  // tapo: the single supported stream is already the substream
  return null;
}

/**
 * @description Build the go2rtc stream and Frigate camera sections of a device.
 * @param {object} device - Gladys camera device.
 * @param {object} [recordContent] - Record section to apply (retention settings).
 * @returns {object} Camera name, go2rtc source and Frigate camera section.
 * @example
 * const { cameraName, go2rtcSource, cameraSection } = buildCameraConfig(device);
 */
function buildCameraConfig(device, recordContent = DEFAULT.RECORD_CONTENT) {
  const [, cameraName] = device.external_id.split(':');
  if (!cameraName) {
    throw new BadParameters(`Frigate: device ${device.external_id} has an invalid external id`);
  }

  const sourceType = getDeviceParam(device, CAMERA_PARAMS.SOURCE_TYPE);
  const go2rtcSource = buildGo2rtcSource(device);
  const go2rtcSubSource = buildGo2rtcSubSource(device);

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

  // Always consume through the go2rtc restream: cameras only get one connection.
  // With a secondary source, detection uses the light stream while the main
  // stream keeps the recording quality.
  const inputs = [];
  if (go2rtcSubSource) {
    inputs.push({
      path: `rtsp://127.0.0.1:8554/${cameraName}`,
      roles: ['record'],
    });
    inputs.push({
      path: `rtsp://127.0.0.1:8554/${cameraName}_sub`,
      roles: ['detect'],
    });
  } else {
    const input = {
      path: `rtsp://127.0.0.1:8554/${cameraName}`,
      roles: ['detect', 'record'],
    };
    if (sourceType === SOURCE_TYPES.TAPO) {
      input.input_args = DEFAULT.TAPO_INPUT_ARGS;
    }
    inputs.push(input);
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
      inputs,
    },
    detect,
    objects: {
      track: trackedLabels,
    },
    record: recordContent,
    snapshots: DEFAULT.SNAPSHOTS_CONTENT,
    mqtt: DEFAULT.CAMERA_MQTT_CONTENT,
  };

  // PTZ: declare the ONVIF endpoint of the camera when its dedicated
  // credentials are set (works with any source type). Cameras controlled
  // through a proprietary protocol (D-Link HTTP) have no ONVIF endpoint.
  const ptzProtocol = getDeviceParam(device, CAMERA_PARAMS.PTZ_PROTOCOL);
  const onvifHost = getDeviceParam(device, CAMERA_PARAMS.SOURCE_HOST);
  const onvifUsername = getDeviceParam(device, CAMERA_PARAMS.ONVIF_USERNAME);
  const onvifPassword = getDeviceParam(device, CAMERA_PARAMS.ONVIF_PASSWORD);
  if (onvifHost && onvifUsername && onvifPassword && ptzProtocol !== CONTROL_PROTOCOLS.DLINK_HTTP) {
    cameraSection.onvif = {
      host: onvifHost,
      port: Number(getDeviceParam(device, CAMERA_PARAMS.ONVIF_PORT)) || DEFAULT.ONVIF_PORT,
      user: onvifUsername,
      password: onvifPassword,
    };
  }

  return { cameraName, go2rtcSource, go2rtcSubSource, cameraSection };
}

module.exports = {
  getDeviceParam,
  buildCameraConfig,
};
