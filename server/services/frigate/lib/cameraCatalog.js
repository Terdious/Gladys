const { SOURCE_TYPES, CONTROL_PROTOCOLS, DEFAULT } = require('./constants');

// Community-maintained camera catalog. Each model provides form presets and
// an i18n note key (integration.frigate.device.catalog.notes.<noteKey>)
// explaining what the user has to do for this camera.

// Wired Tapo cameras expose RTSP with a dedicated "camera account"
const TAPO_WIRED_MODELS = ['C100', 'C110', 'C120', 'C200', 'C210', 'C225', 'C310', 'C320WS', 'C325WB', 'C520WS'];
// Battery/solar Tapo cameras have no RTSP: go2rtc tapo:// with the cloud password
const TAPO_BATTERY_MODELS = ['C400', 'C420', 'C425', 'C460', 'C610', 'C645D', 'C660', 'D230'];

const CAMERA_CATALOG = [
  {
    key: 'tapo',
    brand: 'TP-Link Tapo',
    unknownModelNoteKey: 'tapoUnknownModel',
    models: [
      ...TAPO_WIRED_MODELS.map((name) => ({
        name,
        noteKey: 'tapoCameraAccount',
        allowedSourceTypes: [SOURCE_TYPES.RTSP, SOURCE_TYPES.ONVIF, SOURCE_TYPES.CUSTOM],
        preset: {
          sourceType: SOURCE_TYPES.RTSP,
          path: 'stream1',
          subPath: 'stream2',
          rtspPort: 554,
          onvifPort: 2020,
        },
      })),
      ...TAPO_BATTERY_MODELS.map((name) => ({
        name,
        noteKey: 'tapoCloudPassword',
        allowedSourceTypes: [SOURCE_TYPES.TAPO, SOURCE_TYPES.CUSTOM],
        preset: {
          sourceType: SOURCE_TYPES.TAPO,
          extra: DEFAULT.TAPO_SOURCE_EXTRA,
        },
      })),
    ],
  },
  {
    key: 'reolink',
    brand: 'Reolink',
    unknownModelNoteKey: 'reolinkUnknownModel',
    models: [
      {
        name: 'RLC / E1 / Duo (RTSP)',
        noteKey: 'reolinkRtsp',
        allowedSourceTypes: [SOURCE_TYPES.RTSP, SOURCE_TYPES.ONVIF, SOURCE_TYPES.CUSTOM],
        preset: {
          sourceType: SOURCE_TYPES.RTSP,
          path: 'h264Preview_01_main',
          subPath: 'h264Preview_01_sub',
          rtspPort: 554,
          onvifPort: 8000,
        },
      },
      {
        // Standalone battery cameras have no local stream at all: they only
        // work through the Reolink Home Hub, which exposes one RTSP channel
        // per paired camera
        name: 'Argus / battery (Home Hub)',
        noteKey: 'reolinkBatteryHub',
        allowedSourceTypes: [SOURCE_TYPES.RTSP, SOURCE_TYPES.CUSTOM],
        preset: {
          sourceType: SOURCE_TYPES.RTSP,
          path: 'Preview_01_main',
          subPath: 'Preview_01_sub',
          rtspPort: 554,
        },
      },
    ],
  },
  {
    key: 'dlink',
    brand: 'D-Link',
    unknownModelNoteKey: 'dlinkUnknownModel',
    models: [
      {
        // No RTSP on firmware 1.16 (mydlink Lite): local HTTP MJPEG stream,
        // proprietary HTTP control for pan/tilt and night mode
        name: 'DCS-5020L',
        noteKey: 'dlinkMjpeg',
        allowedSourceTypes: [SOURCE_TYPES.MJPEG, SOURCE_TYPES.CUSTOM],
        preset: {
          sourceType: SOURCE_TYPES.MJPEG,
          path: 'video.cgi',
          httpPort: 80,
          ptzProtocol: CONTROL_PROTOCOLS.DLINK_HTTP,
          nightModeProtocol: CONTROL_PROTOCOLS.DLINK_HTTP,
        },
      },
      // mydlink cameras: local access (ONVIF + RTSP) is enabled from the
      // mydlink app, credentials are admin + the camera PIN code
      {
        name: 'DCS-8302LH',
        noteKey: 'dlinkMydlinkLocal',
        allowedSourceTypes: [SOURCE_TYPES.RTSP, SOURCE_TYPES.ONVIF, SOURCE_TYPES.CUSTOM],
        preset: {
          sourceType: SOURCE_TYPES.RTSP,
          path: 'live/profile.0',
          subPath: 'live/profile.1',
          rtspPort: 554,
          onvifPort: 80,
        },
      },
      {
        name: 'DCS-8635LH',
        noteKey: 'dlinkMydlinkLocal',
        allowedSourceTypes: [SOURCE_TYPES.RTSP, SOURCE_TYPES.ONVIF, SOURCE_TYPES.CUSTOM],
        preset: {
          sourceType: SOURCE_TYPES.RTSP,
          path: 'live/profile.0',
          subPath: 'live/profile.1',
          rtspPort: 554,
          onvifPort: 80,
        },
      },
    ],
  },
];

module.exports = {
  CAMERA_CATALOG,
};
