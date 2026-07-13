const { SOURCE_TYPES, DEFAULT } = require('./constants');

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
        preset: {
          sourceType: SOURCE_TYPES.RTSP,
          path: 'stream1',
          subPath: 'stream2',
        },
      })),
      ...TAPO_BATTERY_MODELS.map((name) => ({
        name,
        noteKey: 'tapoCloudPassword',
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
        preset: {
          sourceType: SOURCE_TYPES.RTSP,
          path: 'h264Preview_01_main',
          subPath: 'h264Preview_01_sub',
        },
      },
    ],
  },
];

module.exports = {
  CAMERA_CATALOG,
};
