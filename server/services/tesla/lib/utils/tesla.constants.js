const GLADYS_VARIABLES = {
  CLIENT_ID: 'TESLA_CLIENT_ID',
  CLIENT_SECRET: 'TESLA_CLIENT_SECRET',

  VEHICLE_API: 'TESLA_VEHICLE_API',
  ENERGY_API: 'TESLA_ENERGY_API',

  ACCESS_TOKEN: 'TESLA_ACCESS_TOKEN',
  REFRESH_TOKEN: 'TESLA_REFRESH_TOKEN',
  EXPIRE_IN_TOKEN: 'TESLA_EXPIRE_IN_TOKEN',
};

const STATUS = {
  NOT_INITIALIZED: 'not_initialized',
  CONNECTING: 'connecting',
  DISCONNECTING: 'disconnecting',
  PROCESSING_TOKEN: 'processing token',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: {
    CONNECTING: 'error connecting',
    PROCESSING_TOKEN: 'error processing token',
    DISCONNECTING: 'error disconnecting',
    CONNECTED: 'error connected',
    SET_DEVICES_VALUES: 'error set devices values',
    GET_DEVICES_VALUES: 'error get devices values',
  },
  GET_DEVICES_VALUES: 'get devices values',
  DISCOVERING_DEVICES: 'discovering',
};

const AUTHENTICATION = {
  urlOauth: 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/authorize',
  urlToken: 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token',
  audience: {
    EU: 'https://fleet-api.prd.eu.vn.cloud.tesla.com',
    US: 'https://fleet-api.prd.na.vn.cloud.tesla.com',
  },
  scopeOauth: {
    openid: 'openid',
    offline_access: 'offline_access',
    user_data: 'user_data',
    vehicle_device_data: 'vehicle_device_data',
    vehicle_location: 'vehicle_location',
    vehicle_cmds: 'vehicle_cmds',
    vehicle_charging_cmds: 'vehicle_charging_cmds',
    energy_device_data: 'energy_device_data',
    energy_cmds: 'energy_cmds',
  },
  scopeToken: {
    vehicle_data: 'vehicle_device_data',
    vehicle_commands: 'vehicle_commands',
    energy_device_data: 'energy_device_data',
    energy_device_commands: 'energy_device_commands',
  },
  HEADER: {
    // ACCEPT: 'application/json',
    // HOST: 'fleet-auth.prd.vn.cloud.tesla.com',
    CONTENT_TYPE: 'application/x-www-form-urlencoded',
  },
};

const API_URL = 'https://fleet-api.tesla.com/api/1';
const ENDPOINTS = {
  VEHICLES: '/vehicles',
  VEHICLE_DATA: (id) => `/vehicles/${id}/vehicle_data`,
  VEHICLE_STATE: (id) => `/vehicles/${id}/vehicle_state`,
  VEHICLE_COMMAND: (id) => `/vehicles/${id}/command`,
};

module.exports = {
  GLADYS_VARIABLES,
  STATUS,
  AUTHENTICATION,
  API_URL,
  ENDPOINTS,
};
