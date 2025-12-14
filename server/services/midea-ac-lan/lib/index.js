const { init } = require('./midea-ac-lan.init');
const { disconnect } = require('./midea-ac-lan.disconnect');
const { discover } = require('./midea-ac-lan.discover');
const { restoreConfiguredDevices } = require('./midea-ac-lan.restoreConfiguredDevices');
const { listDevices } = require('./midea-ac-lan.listDevices');
const { scanHosts } = require('./midea-ac-lan.scanHosts');
const { ensureCloudClient, connectCloud, cloudStatus, clearCloudCache } = require('./midea-ac-lan.connectCloud');
const { confirmDevice } = require('./midea-ac-lan.confirmDevice');
const { connect, poll, setValue, publishStatus, getStatus } = require('./device');
const { STATUS } = require('./utils/midea-ac-lan.constants');

const MideaAcLanHandler = function MideaAcLanHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;
  this.status = STATUS.DISCONNECTED;
  this.clients = new Map();
  this.tokenCache = new Map(); // udpId/id -> { key, token }
};

// Core service methods
MideaAcLanHandler.prototype.init = init;
MideaAcLanHandler.prototype.disconnect = disconnect;
MideaAcLanHandler.prototype.discover = discover;
MideaAcLanHandler.prototype.restoreConfiguredDevices = restoreConfiguredDevices;
MideaAcLanHandler.prototype.listDevices = listDevices;
MideaAcLanHandler.prototype.scanHosts = scanHosts;

// Cloud authentication methods
MideaAcLanHandler.prototype.ensureCloudClient = ensureCloudClient;
MideaAcLanHandler.prototype.connectCloud = connectCloud;
MideaAcLanHandler.prototype.cloudStatus = cloudStatus;
MideaAcLanHandler.prototype.clearCloudCache = clearCloudCache;

// Device confirmation method
MideaAcLanHandler.prototype.confirmDevice = confirmDevice;

// Device control methods (following Gladys pattern)
MideaAcLanHandler.prototype.connect = connect;
MideaAcLanHandler.prototype.poll = poll;
MideaAcLanHandler.prototype.setValue = setValue;
MideaAcLanHandler.prototype.publishStatus = publishStatus;
MideaAcLanHandler.prototype.getStatus = getStatus;

module.exports = MideaAcLanHandler;