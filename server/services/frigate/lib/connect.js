const logger = require('../../../utils/logger');
const { DEFAULT } = require('./constants');

/**
 * @description Connect Gladys to the Frigate MQTT broker.
 * @param {object} MqttParam - MQTT broker URL, Client MQTT username, Client MQTT password.
 * @param {string} MqttParam.mqttUrl - MQTT URL.
 * @param {string} MqttParam.mqttUsername - MQTT Username.
 * @param {string} MqttParam.mqttPassword - MQTT Password.
 * @returns {Promise} Resolve when connected.
 * @example
 * await frigate.connect({ mqttUrl, mqttUsername, mqttPassword });
 */
async function connect({ mqttUrl, mqttUsername, mqttPassword }) {
  if (this.mqttClient) {
    logger.info(`Disconnecting existing MQTT client...`);
    this.mqttClient.end();
    this.mqttClient.removeAllListeners();
    this.mqttClient = null;
  }

  if (!this.mqttRunning) {
    logger.warn(`Can't connect Gladys to Frigate MQTT broker cause MQTT not running !`);
    return;
  }

  logger.info(`Connecting Gladys to ${mqttUrl} MQTT broker...`);

  this.mqttClient = this.mqttLibrary.connect(mqttUrl, {
    username: mqttUsername,
    password: mqttPassword,
    reconnectPeriod: 5000,
    clientId: `gladys-main-instance-frigate-${Math.floor(Math.random() * 1000000)}`,
  });

  this.mqttClient.on('connect', () => {
    logger.info('Connected to Frigate MQTT broker', mqttUrl);
    DEFAULT.TOPICS.forEach((topic) => {
      this.subscribe(topic, this.handleMqttMessage.bind(this));
    });
    this.gladysConnected = true;
    this.mqttRunning = true;
    this.mqttExist = true;
    this.emitStatusEvent();
  });

  this.mqttClient.on('error', (err) => {
    logger.warn(`Error while connecting to Frigate MQTT broker - ${err}`);
    this.gladysConnected = false;
    this.frigateConnected = false;
    this.emitStatusEvent();
  });

  this.mqttClient.on('offline', () => {
    logger.warn(`Disconnected from Frigate MQTT broker`);
    this.gladysConnected = false;
    this.frigateConnected = false;
    this.emitStatusEvent();
  });

  this.mqttClient.on('message', (topic, message) => {
    this.handleMqttMessage(topic, message.toString());
  });
}

module.exports = {
  connect,
};
