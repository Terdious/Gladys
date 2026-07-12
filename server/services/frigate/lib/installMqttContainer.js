const cloneDeep = require('lodash.clonedeep');
const { promisify } = require('util');
const path = require('path');
const fse = require('fs-extra');

const logger = require('../../../utils/logger');

const containerDescriptor = require('../docker/gladys-frigate-mqtt-container.json');

const sleep = promisify(setTimeout);

/**
 * @description Install and starts the dedicated Frigate MQTT container.
 * @param {object} config - Service configuration properties.
 * @example
 * await frigate.installMqttContainer(config);
 */
async function installMqttContainer(config) {
  let dockerContainers = await this.gladys.system.getContainers({
    all: true,
    filters: { name: [containerDescriptor.name] },
  });
  let [container] = dockerContainers;

  if (dockerContainers.length === 0) {
    let containerMqtt;
    try {
      logger.info('Frigate MQTT broker is being installed as Docker container...');
      logger.info(`Pulling ${containerDescriptor.Image} image...`);
      await this.gladys.system.pull(containerDescriptor.Image);

      // Prepare broker env
      logger.info(`Preparing Frigate broker environment...`);
      const containerDescriptorToMutate = cloneDeep(containerDescriptor);
      const { basePathOnContainer, basePathOnHost } = await this.gladys.system.getGladysBasePath();

      const mosquittoFolderPath = path.join(basePathOnContainer, '/frigate/mqtt');
      const mosquittoConfigFilePath = path.join(mosquittoFolderPath, 'mosquitto.conf');
      const mosquittoPasswordFilePath = path.join(mosquittoFolderPath, 'mosquitto.passwd');

      logger.info(`Writing Mosquitto config file in ${mosquittoConfigFilePath}`);

      // Ensure that the mosquitto folder exist
      await fse.ensureDir(mosquittoFolderPath);
      const mosquittoConfTemplate = await fse.readFile(path.join(__dirname, '../docker/mosquitto.conf'), 'utf-8');
      const mosquittoConfContent = mosquittoConfTemplate.replace('listener 1885', `listener ${config.mqttPort}`);
      await fse.writeFile(mosquittoConfigFilePath, mosquittoConfContent, 'utf-8');
      // create an empty password file so that the container can start
      // it'll be filled later
      await fse.writeFile(mosquittoPasswordFilePath, '', 'utf-8');

      containerDescriptorToMutate.ExposedPorts = { [`${config.mqttPort}/tcp`]: {} };
      containerDescriptorToMutate.HostConfig.PortBindings = {
        [`${config.mqttPort}/tcp`]: [{ HostPort: `${config.mqttPort}` }],
      };
      containerDescriptorToMutate.HostConfig.Binds.push(`${basePathOnHost}/frigate/mqtt:/mosquitto/config`);

      logger.info(`Creating container with data in "${basePathOnHost}" on host...`);
      containerMqtt = await this.gladys.system.createContainer(containerDescriptorToMutate);
      logger.trace(containerMqtt);
      this.mqttExist = true;
    } catch (e) {
      logger.error('Frigate MQTT broker failed to install as Docker container:', e);
      this.mqttExist = false;
      throw e;
    } finally {
      this.emitStatusEvent();
    }

    try {
      logger.info('Frigate MQTT broker is restarting...');
      await this.gladys.system.restartContainer(containerMqtt.id);

      // Wait a few seconds for the container to restart
      await sleep(this.containerRestartWaitTimeInMs);

      // Copy password in broker container
      const { frigateMqttUsername, frigateMqttPassword, mqttUsername, mqttPassword } = config;
      logger.info(`Creating user/pass...`);
      await this.gladys.system.exec(containerMqtt.id, {
        Cmd: ['mosquitto_passwd', '-b', '/mosquitto/config/mosquitto.passwd', frigateMqttUsername, frigateMqttPassword],
      });
      await this.gladys.system.exec(containerMqtt.id, {
        Cmd: ['mosquitto_passwd', '-b', '/mosquitto/config/mosquitto.passwd', mqttUsername, mqttPassword],
      });

      // Container restart to initialize users configuration
      logger.info('Frigate MQTT broker is restarting...');
      await this.gladys.system.restartContainer(containerMqtt.id);
      // wait 5 seconds for the container to restart
      await sleep(this.containerRestartWaitTimeInMs);

      logger.info('Frigate MQTT broker container successfully started and configured');

      this.mqttRunning = true;
      this.mqttExist = true;
    } catch (e) {
      logger.error('Frigate MQTT broker container failed to start:', e);
      this.mqttRunning = false;
      throw e;
    } finally {
      this.emitStatusEvent();
    }
  } else {
    this.mqttExist = true;
    try {
      dockerContainers = await this.gladys.system.getContainers({
        all: true,
        filters: { name: [containerDescriptor.name] },
      });
      [container] = dockerContainers;
      if (container.state !== 'running') {
        logger.info('Frigate MQTT broker is starting...');
        await this.gladys.system.restartContainer(container.id);
        // wait a few seconds for the container to restart
        await sleep(this.containerRestartWaitTimeInMs);
      }

      logger.info('Frigate MQTT broker container successfully started');
      this.mqttRunning = true;
      this.mqttExist = true;
    } catch (e) {
      logger.error('Frigate MQTT broker container failed to start:', e);
      this.mqttRunning = false;
      throw e;
    } finally {
      this.emitStatusEvent();
    }
  }
}

module.exports = {
  installMqttContainer,
};
