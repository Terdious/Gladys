const { init } = require('./tesla.init');
const { connect } = require('./tesla.connect');
const { disconnect } = require('./tesla.disconnect');
const { getAccessToken } = require('./tesla.getAccessToken');
const { getConfiguration } = require('./tesla.getConfiguration');
const { getRefreshToken } = require('./tesla.getRefreshToken');
const { getStatus } = require('./tesla.getStatus');
const { saveStatus } = require('./tesla.saveStatus');
const { saveConfiguration } = require('./tesla.saveConfiguration');
const { setTokens } = require('./tesla.setTokens');
const { retrieveTokens } = require('./tesla.retrieveTokens');
const { refreshingTokens } = require('./tesla.refreshingTokens');

const { STATUS, API_URL, ENDPOINTS } = require('./utils/tesla.constants');

const TeslaHandler = function TeslaHandler(gladys, serviceId) {
	this.gladys = gladys;
	this.serviceId = serviceId;
	this.configuration = {
		clientId: null,
		clientSecret: null,
		// vehicleApi: false,
		// energyApi: false,
		// scopes: {
		// 	vehicle_data: 'vehicle_device_data',
		// 	vehicle_commands: 'vehicle_commands',
		// 	energy_device_data: 'energy_device_data',
		// 	energy_device_commands: 'energy_device_commands'
		// }
	};
	this.configured = false;
	this.connected = false;
	this.redirectUri = null;
	this.accessToken = null;
	this.refreshToken = null;
	this.expireInToken = null;
	this.stateGetAccessToken = null;
	this.status = STATUS.NOT_INITIALIZED;
	this.pollRefreshToken = undefined;
	this.pollRefreshValues = undefined;
}

// Bind all methods to the TeslaHandler instance
TeslaHandler.prototype.init = init;
TeslaHandler.prototype.connect = connect;
TeslaHandler.prototype.disconnect = disconnect;
TeslaHandler.prototype.getAccessToken = getAccessToken;
TeslaHandler.prototype.getConfiguration = getConfiguration;
TeslaHandler.prototype.getRefreshToken = getRefreshToken;
TeslaHandler.prototype.getStatus = getStatus;
TeslaHandler.prototype.saveStatus = saveStatus;
TeslaHandler.prototype.saveConfiguration = saveConfiguration;
TeslaHandler.prototype.setTokens = setTokens;
TeslaHandler.prototype.retrieveTokens = retrieveTokens;
TeslaHandler.prototype.refreshingTokens = refreshingTokens;

module.exports = TeslaHandler; 