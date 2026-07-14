const logger = require('../../../utils/logger');
const { CONFIGURATION, DETECTORS, MODES, DEFAULT } = require('./constants');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { generate } = require('../../../utils/password');
const { PlatformNotCompatible } = require('../../../utils/coreErrors');

/**
 * @description Prepares service and starts connection with broker if enabled.
 * @returns {Promise} Resolve when init finished.
 * @example
 * await frigate.init();
 */
async function init() {
  // Reset status
  this.dockerBased = false;
  this.networkModeValid = false;
  this.mqttExist = false;
  this.mqttRunning = false;
  this.frigateExist = false;
  this.frigateRunning = false;
  this.gladysConnected = false;
  this.frigateConnected = false;

  // Load stored configuration
  const configuration = await this.getConfiguration();
  this.frigateEnabled = configuration.frigateEnabled;
  this.detector = configuration.detector || DETECTORS.AUTO;
  this.mode = configuration.mode || MODES.LOCAL;

  // Remote mode: connect to a Frigate running on another machine. No Docker
  // requirement, no containers, no configuration generation: the remote
  // instance stays owned by its own installation.
  if (this.mode === MODES.REMOTE) {
    this.remoteAuthToken = null;
    if (!this.frigateEnabled) {
      logger.info('Frigate integration is not enabled, skipping remote connection');
      this.emitStatusEvent();
      return null;
    }
    if (!configuration.remoteHost || !configuration.remoteMqttHost) {
      this.emitStatusEvent();
      throw new ServiceNotConfiguredError('FRIGATE_REMOTE_NOT_CONFIGURED');
    }
    this.remote = {
      host: configuration.remoteHost,
      port: Number(configuration.remotePort) || DEFAULT.REMOTE_UI_PORT,
      username: configuration.remoteUsername,
      password: configuration.remotePassword,
    };
    const remoteMqttPort = Number(configuration.remoteMqttPort) || DEFAULT.PORTS.MQTT.min;
    await this.connect({
      mqttUrl: `mqtt://${configuration.remoteMqttHost}:${remoteMqttPort}`,
      mqttUsername: configuration.remoteMqttUsername,
      mqttPassword: configuration.remoteMqttPassword,
    });
    return null;
  }

  try {
    const dockerBased = await this.gladys.system.isDocker();
    if (!dockerBased) {
      throw new PlatformNotCompatible('SYSTEM_NOT_RUNNING_DOCKER');
    }
    this.dockerBased = true;
    this.emitStatusEvent();

    const networkMode = await this.gladys.system.getNetworkMode();
    if (networkMode !== 'host') {
      throw new PlatformNotCompatible('DOCKER_BAD_NETWORK');
    }
    this.networkModeValid = true;
  } catch (e) {
    logger.debug(e);
    this.emitStatusEvent();
    if (this.frigateEnabled) {
      throw e;
    }
    return null;
  }

  await this.detectHardware();
  this.emitStatusEvent();

  if (!this.frigateEnabled) {
    logger.info('Frigate integration is not enabled, skipping containers installation');
    return null;
  }

  // Check for existing credentials for Gladys
  if (!configuration.mqttPassword) {
    configuration.mqttUsername = CONFIGURATION.GLADYS_MQTT_USERNAME_VALUE;
    configuration.mqttPassword = generate(20, {
      number: true,
      lowercase: true,
      uppercase: true,
    });
  }
  // Check for existing credentials for Frigate
  if (!configuration.frigateMqttPassword) {
    configuration.frigateMqttUsername = CONFIGURATION.FRIGATE_MQTT_USERNAME_VALUE;
    configuration.frigateMqttPassword = generate(20, {
      number: true,
      lowercase: true,
      uppercase: true,
    });
  }

  // Allocate free host ports (kept as-is when already allocated)
  await this.allocatePorts(configuration);
  configuration.mqttUrl = `mqtt://localhost:${configuration.mqttPort}`;
  this.mqttPort = configuration.mqttPort;
  this.frigateUiPort = configuration.frigateUiPort;
  this.frigateApiPort = configuration.frigateApiPort;
  this.frigateRtspPort = configuration.frigateRtspPort;
  this.emitStatusEvent();

  // Persist credentials and ports before any container operation, so that a
  // failure below does not leave containers configured with lost credentials
  await this.saveConfiguration(configuration);

  logger.debug('Frigate: installing and starting required docker containers...');
  await this.checkForContainerUpdates(configuration);
  await this.installMqttContainer(configuration);
  await this.installFrigateContainer(configuration);

  await this.connect(configuration);

  await this.saveConfiguration(configuration);

  return null;
}

module.exports = {
  init,
};
