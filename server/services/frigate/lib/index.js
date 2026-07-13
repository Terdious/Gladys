const { init } = require('./init');
const { allocatePorts } = require('./allocatePorts');
const { connect } = require('./connect');
const { disconnect } = require('./disconnect');
const { subscribe } = require('./subscribe');
const { handleMqttMessage } = require('./handleMqttMessage');
const { configureAdminUser } = require('./configureAdminUser');
const { getImage } = require('./getImage');
const { poll } = require('./poll');
const { updateCameraImage } = require('./updateCameraImage');
const { getConfiguration } = require('./getConfiguration');
const { getRetentionSettings } = require('./getRetentionSettings');
const { saveConfiguration } = require('./saveConfiguration');
const { saveOrDestroyVariable } = require('./saveOrDestroyVariable');
const { setEnabled } = require('./setEnabled');
const { status } = require('./status');
const { checkForContainerUpdates } = require('./checkForContainerUpdates');
const { detectHardware } = require('./detectHardware');
const { getDockerContainer } = require('./getDockerContainer');
const { installMqttContainer } = require('./installMqttContainer');
const { installFrigateContainer } = require('./installFrigateContainer');
const { configureContainer } = require('./configureContainer');

// EVENTS
const { emitStatusEvent } = require('./events/emitStatusEvent');

/**
 * @description Add ability to manage a Frigate video surveillance instance.
 * @param {object} gladys - Gladys instance.
 * @param {object} mqttLibrary - MQTT lib.
 * @param {string} serviceId - UUID of the service in DB.
 * @example
 * const frigateManager = new FrigateManager(gladys, mqttLibrary, serviceId);
 */
const FrigateManager = function FrigateManager(gladys, mqttLibrary, serviceId) {
  this.gladys = gladys;
  this.mqttLibrary = mqttLibrary;
  this.serviceId = serviceId;
  this.mqttClient = null;

  this.topicBinds = {};
  this.stats = null;
  this.dockerBased = false;
  this.networkModeValid = false;
  this.frigateEnabled = false;
  this.mqttExist = false;
  this.mqttRunning = false;
  this.frigateExist = false;
  this.frigateRunning = false;
  this.gladysConnected = false;
  this.frigateConnected = false;
  this.adminConfigured = false;
  this.adminConfiguring = false;
  this.vaapiAvailable = false;
  this.openvinoCapable = false;
  this.renderDevicePath = null;
  this.coralAvailable = false;
  this.coralDeviceType = null;
  this.detector = 'auto';
  this.mqttPort = null;
  this.frigateUiPort = null;
  this.frigateApiPort = null;
  this.frigateRtspPort = null;

  this.containerRestartWaitTimeInMs = 5 * 1000;
};

FrigateManager.prototype.init = init;
FrigateManager.prototype.allocatePorts = allocatePorts;
FrigateManager.prototype.connect = connect;
FrigateManager.prototype.disconnect = disconnect;
FrigateManager.prototype.subscribe = subscribe;
FrigateManager.prototype.handleMqttMessage = handleMqttMessage;
FrigateManager.prototype.configureAdminUser = configureAdminUser;
FrigateManager.prototype.getImage = getImage;
FrigateManager.prototype.poll = poll;
FrigateManager.prototype.updateCameraImage = updateCameraImage;
FrigateManager.prototype.getConfiguration = getConfiguration;
FrigateManager.prototype.getRetentionSettings = getRetentionSettings;
FrigateManager.prototype.saveConfiguration = saveConfiguration;
FrigateManager.prototype.saveOrDestroyVariable = saveOrDestroyVariable;
FrigateManager.prototype.setEnabled = setEnabled;
FrigateManager.prototype.status = status;
FrigateManager.prototype.checkForContainerUpdates = checkForContainerUpdates;
FrigateManager.prototype.detectHardware = detectHardware;
FrigateManager.prototype.getDockerContainer = getDockerContainer;
FrigateManager.prototype.installMqttContainer = installMqttContainer;
FrigateManager.prototype.installFrigateContainer = installFrigateContainer;
FrigateManager.prototype.configureContainer = configureContainer;

// EVENTS
FrigateManager.prototype.emitStatusEvent = emitStatusEvent;

module.exports = FrigateManager;
