const CONFIGURATION = {
  FRIGATE_ENABLED: 'FRIGATE_ENABLED',
  GLADYS_MQTT_USERNAME_KEY: 'FRIGATE_GLADYS_MQTT_USERNAME',
  GLADYS_MQTT_USERNAME_VALUE: 'gladys',
  GLADYS_MQTT_PASSWORD_KEY: 'FRIGATE_GLADYS_MQTT_PASSWORD',
  FRIGATE_MQTT_USERNAME_KEY: 'FRIGATE_MQTT_USERNAME',
  FRIGATE_MQTT_USERNAME_VALUE: 'frigate',
  FRIGATE_MQTT_PASSWORD_KEY: 'FRIGATE_MQTT_PASSWORD',
  FRIGATE_ADMIN_USERNAME_VALUE: 'admin',
  FRIGATE_ADMIN_PASSWORD_KEY: 'FRIGATE_ADMIN_PASSWORD',
  MQTT_PORT_KEY: 'FRIGATE_MQTT_PORT',
  UI_PORT_KEY: 'FRIGATE_UI_PORT',
  API_PORT_KEY: 'FRIGATE_API_PORT',
  RTSP_PORT_KEY: 'FRIGATE_RTSP_PORT',
  DOCKER_MQTT_VERSION: 'FRIGATE_DOCKER_MQTT_VERSION', // Variable to identify last version of MQTT docker file is installed
  DOCKER_FRIGATE_VERSION: 'FRIGATE_DOCKER_FRIGATE_VERSION', // Variable to identify last version of Frigate docker file is installed
};

const MQTT_TOPICS = {
  AVAILABLE: 'frigate/available',
  STATS: 'frigate/stats',
};

const DEVICE_EXTERNAL_ID_PREFIX = 'frigate';

const CAMERA_PARAMS = {
  SOURCE_TYPE: 'FRIGATE_SOURCE_TYPE',
  SOURCE_HOST: 'FRIGATE_SOURCE_HOST',
  SOURCE_USERNAME: 'FRIGATE_SOURCE_USERNAME',
  SOURCE_PASSWORD: 'FRIGATE_SOURCE_PASSWORD',
  SOURCE_PATH: 'FRIGATE_SOURCE_PATH',
  SOURCE_EXTRA: 'FRIGATE_SOURCE_EXTRA',
  CUSTOM_SOURCE: 'FRIGATE_CUSTOM_SOURCE',
  TRACKED_LABELS: 'FRIGATE_TRACKED_LABELS',
  DETECT_FPS: 'FRIGATE_DETECT_FPS',
};

const SOURCE_TYPES = {
  RTSP: 'rtsp',
  TAPO: 'tapo',
  CUSTOM: 'custom',
};

// Subset of the COCO labelmap relevant for home video surveillance
const TRACKABLE_LABELS = ['person', 'car', 'dog', 'cat', 'horse', 'bird', 'bicycle', 'motorcycle', 'bus', 'truck'];

const DEFAULT = {
  TOPICS: [
    'frigate/#', // Default frigate topic
  ],
  DOCKER_MQTT_VERSION: '1', // Last version of MQTT docker file
  DOCKER_FRIGATE_VERSION: '1', // Last version of Frigate docker file
  CONFIGURATION_PATH: 'frigate/config/config.yml',
  // Hostname resolving to the Docker host from the Frigate container (bridge network)
  MQTT_HOST_FROM_CONTAINER: 'host.docker.internal',
  // Port ranges used to find a free port on the host, incrementing from `min`
  PORTS: {
    MQTT: { min: 1885, max: 1899 },
    UI: { min: 8971, max: 8999 },
    API: { min: 5000, max: 5099 },
    RTSP: { min: 8554, max: 8599 },
  },
  CONFIGURATION_CONTENT: {
    mqtt: {
      enabled: true,
    },
    cameras: {},
  },
  DETECT_FPS: 5,
  // Validated defaults for the tapo:// producer: non-monotonic DTS make ffmpeg
  // runaway without wallclock re-timestamping
  TAPO_INPUT_ARGS:
    '-avoid_negative_ts make_zero -fflags +genpts+discardcorrupt -rtsp_transport tcp -use_wallclock_as_timestamps 1',
  TAPO_SOURCE_EXTRA: 'channel=0&subtype=1',
  TAPO_DETECT_WIDTH: 640,
  TAPO_DETECT_HEIGHT: 360,
  RTSP_PORT: 554,
  // Frigate 0.16+ record schema (continuous/alerts/detections)
  RECORD_CONTENT: {
    enabled: true,
    continuous: {
      days: 2,
    },
    alerts: {
      retain: {
        days: 7,
      },
    },
    detections: {
      retain: {
        days: 7,
      },
    },
  },
  SNAPSHOTS_CONTENT: {
    enabled: true,
    retain: {
      default: 14,
    },
  },
  IMAGE_HEIGHT: 360,
};

module.exports = {
  CONFIGURATION,
  MQTT_TOPICS,
  DEVICE_EXTERNAL_ID_PREFIX,
  CAMERA_PARAMS,
  SOURCE_TYPES,
  TRACKABLE_LABELS,
  DEFAULT,
};
