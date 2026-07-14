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
  RECORD_CONTINUOUS_DAYS_KEY: 'FRIGATE_RECORD_CONTINUOUS_DAYS',
  RECORD_ALERTS_DAYS_KEY: 'FRIGATE_RECORD_ALERTS_DAYS',
  RECORD_DETECTIONS_DAYS_KEY: 'FRIGATE_RECORD_DETECTIONS_DAYS',
  DETECTOR_KEY: 'FRIGATE_DETECTOR',
  DOCKER_MQTT_VERSION: 'FRIGATE_DOCKER_MQTT_VERSION', // Variable to identify last version of MQTT docker file is installed
  DOCKER_FRIGATE_VERSION: 'FRIGATE_DOCKER_FRIGATE_VERSION', // Variable to identify last version of Frigate docker file is installed
};

const MQTT_TOPICS = {
  AVAILABLE: 'frigate/available',
  STATS: 'frigate/stats',
  RESTART: 'frigate/restart',
};

const DEVICE_EXTERNAL_ID_PREFIX = 'frigate';

const CAMERA_PARAMS = {
  CAMERA_BRAND: 'FRIGATE_CAMERA_BRAND',
  CAMERA_MODEL: 'FRIGATE_CAMERA_MODEL',
  SOURCE_TYPE: 'FRIGATE_SOURCE_TYPE',
  SOURCE_HOST: 'FRIGATE_SOURCE_HOST',
  SOURCE_USERNAME: 'FRIGATE_SOURCE_USERNAME',
  SOURCE_PASSWORD: 'FRIGATE_SOURCE_PASSWORD',
  SOURCE_PATH: 'FRIGATE_SOURCE_PATH',
  SOURCE_SUB_PATH: 'FRIGATE_SOURCE_SUB_PATH',
  SOURCE_EXTRA: 'FRIGATE_SOURCE_EXTRA',
  CUSTOM_SOURCE: 'FRIGATE_CUSTOM_SOURCE',
  CUSTOM_SUB_SOURCE: 'FRIGATE_CUSTOM_SUB_SOURCE',
  TAPO_AUTH_VARIANT: 'FRIGATE_TAPO_AUTH_VARIANT',
  SOURCE_RTSP_PORT: 'FRIGATE_CAMERA_RTSP_PORT',
  ONVIF_PORT: 'FRIGATE_CAMERA_ONVIF_PORT',
  ONVIF_USERNAME: 'FRIGATE_ONVIF_USERNAME',
  ONVIF_PASSWORD: 'FRIGATE_ONVIF_PASSWORD',
  TRACKED_LABELS: 'FRIGATE_TRACKED_LABELS',
  DETECT_FPS: 'FRIGATE_DETECT_FPS',
};

const SOURCE_TYPES = {
  RTSP: 'rtsp',
  TAPO: 'tapo',
  ONVIF: 'onvif',
  CUSTOM: 'custom',
};

const TAPO_AUTH_VARIANTS = {
  CLOUD: 'cloud',
  SHA256: 'sha256',
};

// Object detector choices offered on the setup page
const DETECTORS = {
  AUTO: 'auto',
  CORAL: 'coral',
  OPENVINO: 'openvino',
  CPU: 'cpu',
};

// Google Coral form factors
const CORAL_DEVICE_TYPES = {
  USB: 'usb',
  PCIE: 'pcie',
};

// PCI vendor ids of the render nodes, read from sysfs
const GPU_VENDORS = {
  INTEL: '0x8086',
  AMD: '0x1002',
  NVIDIA: '0x10de',
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
  ONVIF_PORT: 80,
  // Path of the render node INSIDE the Frigate container: whatever host node
  // is selected, it is always mapped there because the Frigate presets and
  // OpenVINO expect the default node path
  RENDER_DEVICE_PATH: '/dev/dri/renderD128',
  DRM_DEVICES_PATH: '/dev/dri',
  DRM_SYS_CLASS_PATH: '/sys/class/drm',
  // Google Coral: PCIe/M.2 exposes an apex device, USB is identified by its
  // vendor id (1a6e before the runtime flashes it, 18d1 after)
  CORAL_PCIE_DEVICE_PATH: '/dev/apex_0',
  CORAL_USB_DEVICE_PATH: '/dev/bus/usb',
  USB_SYS_DEVICES_PATH: '/sys/bus/usb/devices',
  CORAL_USB_VENDOR_IDS: ['1a6e', '18d1'],
  // Frigate embeds the default EdgeTPU model: no model section needed
  EDGETPU_DETECTORS_USB: {
    coral: {
      type: 'edgetpu',
      device: 'usb',
    },
  },
  EDGETPU_DETECTORS_PCIE: {
    coral: {
      type: 'edgetpu',
      device: 'pci',
    },
  },
  CPU_DETECTORS: {
    cpu0: {
      type: 'cpu',
    },
  },
  // Validated on Intel N5105: inference 94.6ms (CPU) -> 15.8ms (GPU)
  OPENVINO_DETECTORS: {
    ov: {
      type: 'openvino',
      device: 'GPU',
    },
  },
  OPENVINO_MODEL: {
    width: 300,
    height: 300,
    input_tensor: 'nhwc',
    input_pixel_format: 'bgr',
    path: '/openvino-model/ssdlite_mobilenet_v2.xml',
    labelmap_path: '/openvino-model/coco_91cl_bkgr.txt',
  },
  VAAPI_FFMPEG: {
    hwaccel_args: 'preset-vaapi',
  },
  // 256MB validated for 1 camera, add headroom per extra camera
  SHM_BASE_BYTES: 268435456,
  SHM_PER_EXTRA_CAMERA_BYTES: 67108864,
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
  TAPO_AUTH_VARIANTS,
  DETECTORS,
  CORAL_DEVICE_TYPES,
  GPU_VENDORS,
  TRACKABLE_LABELS,
  DEFAULT,
};
