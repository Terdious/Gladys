const CONFIGURATION = {
  FRIGATE_ENABLED: 'FRIGATE_ENABLED',
  GLADYS_MQTT_USERNAME_KEY: 'FRIGATE_GLADYS_MQTT_USERNAME',
  GLADYS_MQTT_USERNAME_VALUE: 'gladys',
  GLADYS_MQTT_PASSWORD_KEY: 'FRIGATE_GLADYS_MQTT_PASSWORD',
  FRIGATE_MQTT_USERNAME_KEY: 'FRIGATE_MQTT_USERNAME',
  FRIGATE_MQTT_USERNAME_VALUE: 'frigate',
  FRIGATE_MQTT_PASSWORD_KEY: 'FRIGATE_MQTT_PASSWORD',
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
};

module.exports = {
  CONFIGURATION,
  MQTT_TOPICS,
  DEFAULT,
};
