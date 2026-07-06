const { init } = require('./tuya.init');
const { connect } = require('./tuya.connect');
const { disconnect } = require('./tuya.disconnect');
const { setTokens } = require('./tuya.setTokens');
const { getAccessToken } = require('./tuya.getAccessToken');
const { getRefreshToken } = require('./tuya.getRefreshToken');
const { getConfiguration } = require('./tuya.getConfiguration');
const { saveConfiguration } = require('./tuya.saveConfiguration');
const { discoverDevices } = require('./tuya.discoverDevices');
const { loadDevices } = require('./tuya.loadDevices');
const { loadDeviceDetails } = require('./tuya.loadDeviceDetails');
const { setValue } = require('./tuya.setValue');
const { poll } = require('./tuya.poll');
const { localScan } = require('./tuya.localScan');
const { localPoll } = require('./tuya.localPoll');
const { getStatus } = require('./tuya.getStatus');
const { manualDisconnect } = require('./tuya.manualDisconnect');
const {
  tryReconnect,
  scheduleQuickReconnects,
  clearQuickReconnects,
  startReconnect,
  stopReconnect,
} = require('./tuya.reconnect');
const {
  startPersistentConnections,
  startPersistentConnectionForDevice,
  handlePushedDps,
  isPersistentConnectionHealthy,
  isPersistentConnectionConnected,
  sendCommandViaPersistentConnection,
  probePersistentConnection,
  recyclePersistentConnection,
  stopPersistentConnectionForDevice,
  stopPersistentConnections,
  postCreate,
  postUpdate,
  postDelete,
} = require('./tuya.persistentConnection');
const { recordDiagnostic, getDiagnostics, recordRawValues, getRawValues } = require('./tuya.diagnostics');
const { getDeviceSnapshot } = require('./tuya.deviceSnapshot');
const { handleMediaValue, processMediaCodes } = require('./tuya.media');
const { handlePulsarEvent, startPulsar, stopPulsar } = require('./tuya.pulsar');

const { STATUS } = require('./utils/tuya.constants');

const TuyaHandler = function TuyaHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;

  this.connector = null;
  this.status = STATUS.NOT_INITIALIZED;
  this.lastError = null;
  this.autoReconnectAllowed = false;
  this.reconnectInterval = null;
  this.quickReconnectTimeouts = [];
  this.quickReconnectInProgress = false;
  this.degradedDevices = {};
  this.persistentConnections = {};
  this.persistentPushEnabled = true;
};

TuyaHandler.prototype.init = init;
TuyaHandler.prototype.connect = connect;
TuyaHandler.prototype.disconnect = disconnect;
TuyaHandler.prototype.setTokens = setTokens;
TuyaHandler.prototype.getAccessToken = getAccessToken;
TuyaHandler.prototype.getRefreshToken = getRefreshToken;
TuyaHandler.prototype.getConfiguration = getConfiguration;
TuyaHandler.prototype.saveConfiguration = saveConfiguration;
TuyaHandler.prototype.discoverDevices = discoverDevices;
TuyaHandler.prototype.loadDevices = loadDevices;
TuyaHandler.prototype.loadDeviceDetails = loadDeviceDetails;
TuyaHandler.prototype.setValue = setValue;
TuyaHandler.prototype.poll = poll;
TuyaHandler.prototype.localScan = localScan;
TuyaHandler.prototype.localPoll = localPoll;
TuyaHandler.prototype.getStatus = getStatus;
TuyaHandler.prototype.manualDisconnect = manualDisconnect;
TuyaHandler.prototype.tryReconnect = tryReconnect;
TuyaHandler.prototype.scheduleQuickReconnects = scheduleQuickReconnects;
TuyaHandler.prototype.clearQuickReconnects = clearQuickReconnects;
TuyaHandler.prototype.startReconnect = startReconnect;
TuyaHandler.prototype.stopReconnect = stopReconnect;
TuyaHandler.prototype.startPersistentConnections = startPersistentConnections;
TuyaHandler.prototype.startPersistentConnectionForDevice = startPersistentConnectionForDevice;
TuyaHandler.prototype.handlePushedDps = handlePushedDps;
TuyaHandler.prototype.isPersistentConnectionHealthy = isPersistentConnectionHealthy;
TuyaHandler.prototype.isPersistentConnectionConnected = isPersistentConnectionConnected;
TuyaHandler.prototype.sendCommandViaPersistentConnection = sendCommandViaPersistentConnection;
TuyaHandler.prototype.probePersistentConnection = probePersistentConnection;
TuyaHandler.prototype.recyclePersistentConnection = recyclePersistentConnection;
TuyaHandler.prototype.stopPersistentConnectionForDevice = stopPersistentConnectionForDevice;
TuyaHandler.prototype.stopPersistentConnections = stopPersistentConnections;
// Called by the Gladys DeviceManager (device.notify) after a Tuya device is created/updated/deleted.
TuyaHandler.prototype.postCreate = postCreate;
TuyaHandler.prototype.postUpdate = postUpdate;
TuyaHandler.prototype.postDelete = postDelete;
// In-memory diagnostics buffer + raw-value memory + device snapshot feeding the front diagnostic page.
TuyaHandler.prototype.recordDiagnostic = recordDiagnostic;
TuyaHandler.prototype.getDiagnostics = getDiagnostics;
TuyaHandler.prototype.recordRawValues = recordRawValues;
TuyaHandler.prototype.getRawValues = getRawValues;
TuyaHandler.prototype.getDeviceSnapshot = getDeviceSnapshot;
// Doorbell snapshots: gate the media DPs on their raw payload and store the image on the camera feature.
TuyaHandler.prototype.processMediaCodes = processMediaCodes;
TuyaHandler.prototype.handleMediaValue = handleMediaValue;
// Pulsar message service (opt-in real-time cloud events).
TuyaHandler.prototype.startPulsar = startPulsar;
TuyaHandler.prototype.stopPulsar = stopPulsar;
TuyaHandler.prototype.handlePulsarEvent = handlePulsarEvent;

module.exports = TuyaHandler;
