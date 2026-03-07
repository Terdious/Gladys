const { init } = require('./zendure.init');
const { getConfiguration } = require('./zendure.getConfiguration');
const { saveConfiguration } = require('./zendure.saveConfiguration');
const { connect } = require('./zendure.connect');
const { getStatus } = require('./zendure.getStatus');
const { loadDevices } = require('./zendure.loadDevices');
const { discoverDevices } = require('./zendure.discoverDevices');
const { poll } = require('./zendure.poll');
const { postCreate, postUpdate, postDelete } = require('./device/zendure.postCreate');
const {
  ensureCloudMqttConnection,
  refreshMqttSubscriptions,
  requestMqttDeviceProperties,
  getLatestMqttPayload,
  disconnectMqtt,
} = require('./zendure.mqtt');

const { STATUS } = require('./utils/zendure.constants');

const ZendureHandler = function ZendureHandler(gladys, mqttLibrary, serviceId) {
  this.gladys = gladys;
  this.mqttLibrary = mqttLibrary;
  this.serviceId = serviceId;

  this.status = STATUS.NOT_INITIALIZED;
  this.cloudData = null;
  this.discoveredDevices = [];
  this.lastCloudRefreshAt = 0;
  this.pollRefreshPromise = null;
  this.suspendedPollingDeviceSelectors = new Set();

  this.mqttClient = null;
  this.mqttConnected = false;
  this.mqttConnectionSignature = null;
  this.mqttSubscribedTopics = new Set();
  this.latestMqttPayloadByDeviceKey = new Map();
  this.lastMqttPayloadAtByDeviceKey = new Map();
  this.mqttMessageId = 0;
  this.mqttClientId = `gladys-zendure-${Math.floor(Math.random() * 1000000)}`;
};

ZendureHandler.prototype.init = init;
ZendureHandler.prototype.getConfiguration = getConfiguration;
ZendureHandler.prototype.saveConfiguration = saveConfiguration;
ZendureHandler.prototype.connect = connect;
ZendureHandler.prototype.getStatus = getStatus;
ZendureHandler.prototype.loadDevices = loadDevices;
ZendureHandler.prototype.discoverDevices = discoverDevices;
ZendureHandler.prototype.poll = poll;
ZendureHandler.prototype.postCreate = postCreate;
ZendureHandler.prototype.postUpdate = postUpdate;
ZendureHandler.prototype.postDelete = postDelete;
ZendureHandler.prototype.ensureCloudMqttConnection = ensureCloudMqttConnection;
ZendureHandler.prototype.refreshMqttSubscriptions = refreshMqttSubscriptions;
ZendureHandler.prototype.requestMqttDeviceProperties = requestMqttDeviceProperties;
ZendureHandler.prototype.getLatestMqttPayload = getLatestMqttPayload;
ZendureHandler.prototype.disconnectMqtt = disconnectMqtt;

module.exports = ZendureHandler;
