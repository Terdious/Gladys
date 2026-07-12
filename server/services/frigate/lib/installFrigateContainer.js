const cloneDeep = require('lodash.clonedeep');
const { promisify } = require('util');
const path = require('path');
const fse = require('fs-extra');

const logger = require('../../../utils/logger');

const containerDescriptor = require('../docker/gladys-frigate-container.json');

const sleep = promisify(setTimeout);

/**
 * @description Install and starts the Frigate container.
 * @param {object} config - Service configuration properties.
 * @example
 * await frigate.installFrigateContainer(config);
 */
async function installFrigateContainer(config) {
  let dockerContainers = await this.gladys.system.getContainers({
    all: true,
    filters: { name: [containerDescriptor.name] },
  });
  let [container] = dockerContainers;

  const { basePathOnContainer, basePathOnHost } = await this.gladys.system.getGladysBasePath();

  if (dockerContainers.length === 0) {
    try {
      logger.info('Frigate is being installed as Docker container...');
      logger.info(`Pulling ${containerDescriptor.Image} image...`);
      await this.gladys.system.pull(containerDescriptor.Image);

      const containerDescriptorToMutate = cloneDeep(containerDescriptor);
      containerDescriptorToMutate.HostConfig.Binds.push(`${basePathOnHost}/frigate/config:/config`);
      containerDescriptorToMutate.HostConfig.Binds.push(`${basePathOnHost}/frigate/media:/media/frigate`);
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
    dockerContainers = await this.gladys.system.getContainers({
      all: true,
      filters: { name: [containerDescriptor.name] },
    });
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
