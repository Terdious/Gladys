const { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } = require('../../../../../utils/constants');

// Wifi video doorbell (Tuya category "sp").
// Scope: the writable boolean settings (switch/binary toggles usable from scenes) and the ring
// (doorbell_active as a BUTTON/CLICK event feature). Everything else is deferred (see ignoredCodes):
//  - sd_format_state / sd_status: numeric status codes (not booleans).
//  - motion_sensitivity / record_mode / basic_nightvision: enums needing a select UI (follow-up).
//  - basic_device_volume: numeric volume (follow-up).
//  - sd_storge / sd_format: storage string / maintenance action (follow-up).
//  - movement_detect_pic: snapshot payload — no feature of its own, it feeds the doorbell_pic
//    camera image through the media pipeline (tuya.media.js), like doorbell_pic itself.
module.exports = {
  ignoredCodes: [
    'sd_format_state',
    'sd_status',
    'motion_sensitivity',
    'record_mode',
    'basic_nightvision',
    'basic_device_volume',
    'sd_storge',
    'sd_format',
    'movement_detect_pic',
  ],
  doorbell_pic: {
    // The device camera image (Gladys camera dashboard box + diagnostic page panel). The state
    // pipeline has no reader for camera/image: the feature is only written by the media pipeline
    // (ring and motion snapshots downloaded from the payload's signed URL).
    name: 'Snapshot',
    category: DEVICE_FEATURE_CATEGORIES.CAMERA,
    type: DEVICE_FEATURE_TYPES.CAMERA.IMAGE,
    read_only: true,
    keep_history: false,
  },
  doorbell_active: {
    // The ring: an event DP holding the last ring payload (empty string when the device has never
    // rung). `event: true` routes it through the raw-payload event gate — each NEW payload fires one
    // CLICK, re-reported identical payloads stay silent (no ghost ring on refresh/poll cycles).
    name: 'Doorbell',
    category: DEVICE_FEATURE_CATEGORIES.BUTTON,
    type: DEVICE_FEATURE_TYPES.BUTTON.CLICK,
    read_only: true,
    event: true,
  },
  motion_switch: {
    name: 'Motion detection',
    category: DEVICE_FEATURE_CATEGORIES.SWITCH,
    type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
  },
  record_switch: {
    name: 'Recording',
    category: DEVICE_FEATURE_CATEGORIES.SWITCH,
    type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
  },
  basic_flip: {
    name: 'Image flip',
    category: DEVICE_FEATURE_CATEGORIES.SWITCH,
    type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
  },
  basic_indicator: {
    name: 'Status LED',
    category: DEVICE_FEATURE_CATEGORIES.SWITCH,
    type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
  },
  basic_osd: {
    name: 'On-screen display',
    category: DEVICE_FEATURE_CATEGORIES.SWITCH,
    type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
  },
};
