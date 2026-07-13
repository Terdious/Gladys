const cloneDeep = require('lodash.clonedeep');
const { promisify } = require('util');
const path = require('path');
const fse = require('fs-extra');

const logger = require('../../../utils/logger');
const { DEFAULT, CORAL_DEVICE_TYPES } = require('./constants');
const { computeShmSize } = require('./computeShmSize');

const containerDescriptor = require('../docker/gladys-frigate-container.json');

const sleep = promisify(setTimeout);

/**
 * @description Install and starts the Frigate container.
 * @param {object} config - Service configuration properties.
 * @example
 * await frigate.installFrigateContainer(config);
 */
async function installFrigateContainer(config) {
  let dockerContainers = await this.getDockerContainer(containerDescriptor.name);
  let [container] = dockerContainers;
  let creationNeeded = dockerContainers.length === 0;

  const { basePathOnContainer, basePathOnHost } = await this.gladys.system.getGladysBasePath();

  // Hardware-dependent settings of the container. Detected devices are
  // always exposed so the detector can be switched without recreation.
  const devices = await this.gladys.device.get({ service: 'frigate' });
  const desiredShmSize = computeShmSize(devices.length);
  const desiredDevices = [];
  if (this.vaapiAvailable && this.renderDevicePath) {
    desiredDevices.push({
      PathOnHost: this.renderDevicePath,
      // Always mapped to the default node path: the Frigate presets and
      // OpenVINO expect it, whatever host node was selected (multi-GPU hosts)
      PathInContainer: DEFAULT.RENDER_DEVICE_PATH,
      CgroupPermissions: 'rwm',
    });
  }
  if (this.coralAvailable) {
    const coralDevicePath =
      this.coralDeviceType === CORAL_DEVICE_TYPES.PCIE ? DEFAULT.CORAL_PCIE_DEVICE_PATH : DEFAULT.CORAL_USB_DEVICE_PATH;
    desiredDevices.push({
      PathOnHost: coralDevicePath,
      PathInContainer: coralDevicePath,
      CgroupPermissions: 'rwm',
    });
  }

  // ShmSize and Devices cannot be updated on an existing container:
  // recreate it when they changed (camera added, GPU plugged...)
  if (!creationNeeded) {
    const containerDescription = await this.gladys.system.inspectContainer(container.id);
    const currentDevices = containerDescription.HostConfig.Devices || [];
    const currentShmSize = containerDescription.HostConfig.ShmSize;
    if (JSON.stringify(currentDevices) !== JSON.stringify(desiredDevices) || currentShmSize !== desiredShmSize) {
      logger.info('Frigate container hardware settings changed, recreating container...');
      await this.gladys.system.stopContainer(container.id);
      await this.gladys.system.removeContainer(container.id);
      creationNeeded = true;
    }
  }

  if (creationNeeded) {
    try {
      logger.info('Frigate is being installed as Docker container...');
      logger.info(`Pulling ${containerDescriptor.Image} image...`);
      await this.gladys.system.pull(containerDescriptor.Image);

      const containerDescriptorToMutate = cloneDeep(containerDescriptor);
      containerDescriptorToMutate.HostConfig.Binds.push(`${basePathOnHost}/frigate/config:/config`);
      containerDescriptorToMutate.HostConfig.Binds.push(`${basePathOnHost}/frigate/media:/media/frigate`);
      containerDescriptorToMutate.HostConfig.ShmSize = desiredShmSize;
      containerDescriptorToMutate.HostConfig.Devices = desiredDevices;
      // Frigate runs in UTC by default: align it with the Gladys timezone
      // so recordings and events are timestamped correctly
      if (config.timezone) {
        containerDescriptorToMutate.Env = [`TZ=${config.timezone}`];
      }
      // Bind the authenticated UI on all interfaces, but keep the unauthenticated
      // API and RTSP restream on localhost only (consumed by Gladys itself)
      containerDescriptorToMutate.HostConfig.PortBindings = {
        '8971/tcp': [{ HostPort: `${config.frigateUiPort}` }],
        '5000/tcp': [{ HostIp: '127.0.0.1', HostPort: `${config.frigateApiPort}` }],
        '8554/tcp': [{ HostIp: '127.0.0.1', HostPort: `${config.frigateRtspPort}` }],
      };

      // Ensure that the media folder exists before Docker creates it as root
      await fse.ensureDir(path.join(basePathOnContainer, 'frigate/media'));

      logger.info(`Creation of container...`);
      const containerLog = await this.gladys.system.createContainer(containerDescriptorToMutate);
      logger.trace(containerLog);
      logger.info('Frigate successfully installed and configured as Docker container');
      this.frigateExist = true;
    } catch (e) {
      this.frigateExist = false;
      logger.error('Frigate failed to install as Docker container:', e);
      throw e;
    } finally {
      this.emitStatusEvent();
    }
  } else {
    this.frigateExist = true;
  }

  const { configChanged } = await this.configureContainer(basePathOnContainer, config);

  try {
    dockerContainers = await this.getDockerContainer(containerDescriptor.name);
    [container] = dockerContainers;

    // Check if we need to restart the container (container is not running / config changed)
    if (container.state !== 'running' || configChanged) {
      logger.info('Frigate container is (re)starting...');
      await this.gladys.system.restartContainer(container.id);
      // wait a few seconds for the container to restart
      await sleep(this.containerRestartWaitTimeInMs);
    }

    logger.info('Frigate container successfully started');
    this.frigateRunning = true;
    this.frigateExist = true;
  } catch (e) {
    logger.error('Frigate container failed to start:', e);
    this.frigateRunning = false;
    throw e;
  } finally {
    this.emitStatusEvent();
  }
}

module.exports = {
  installFrigateContainer,
};
