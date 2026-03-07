const GLADYS_VARIABLES = {
  APP_TOKEN: 'ZENDURE_APP_TOKEN',
};

const STATUS = {
  NOT_INITIALIZED: 'not_initialized',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  DISCOVERING_DEVICES: 'discovering',
};

const API = {
  DEVICE_LIST: '/api/ha/deviceList',
};

const AUTH = {
  CLIENT_ID: 'zenHa',
  SIGN_KEY: 'C*dafwArEOXK',
};

const SUPPORTED_PRODUCT_MODELS = {
  SOLARFLOW_800_PRO: 'solarflow 800 pro',
};

const DEVICE_PARAM_NAME = {
  DEVICE_KEY: 'zendure-device-key',
  PRODUCT_KEY: 'zendure-product-key',
  PRODUCT_MODEL: 'zendure-product-model',
  LOCAL_IP: 'zendure-local-ip',
  LOCAL_MQTT_PROTOCOL: 'zendure-local-mqtt-protocol',
  LOCAL_MQTT_SERVER: 'zendure-local-mqtt-server',
  LOCAL_MQTT_PORT: 'zendure-local-mqtt-port',
  LOCAL_MQTT_USERNAME: 'zendure-local-mqtt-username',
  LOCAL_MQTT_PASSWORD: 'zendure-local-mqtt-password',
  LOCAL_MQTT_ENABLED: 'zendure-local-mqtt-enabled',
};

module.exports = {
  GLADYS_VARIABLES,
  STATUS,
  API,
  AUTH,
  SUPPORTED_PRODUCT_MODELS,
  DEVICE_PARAM_NAME,
};
