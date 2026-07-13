const logger = require('../../utils/logger');
const FrigateManager = require('./lib');
const FrigateController = require('./api/frigate.controller');

module.exports = function FrigateService(gladys, serviceId) {
  const mqtt = require('mqtt');
  const childProcess = require('child_process');
  const frigateManager = new FrigateManager(gladys, mqtt, serviceId, childProcess);

  /**
   * @public
   * @description This function starts service.
   * @example
   * gladys.services.frigate.start();
   */
  async function start() {
    logger.log('Starting Frigate service');
    await frigateManager.init();
  }

  /**
   * @public
   * @description This function stops the service.
   * @example
   *  gladys.services.frigate.stop();
   */
  function stop() {
    logger.log('Stopping Frigate service');
    frigateManager.disconnect();
  }

  /**
   * @public
   * @description Test if Frigate is used.
   * @returns {Promise<boolean>} Returns true if Frigate is connected.
   * @example
   *  const used = await gladys.services.frigate.isUsed();
   */
  async function isUsed() {
    return frigateManager.gladysConnected && frigateManager.frigateConnected;
  }

  return Object.freeze({
    start,
    stop,
    isUsed,
    device: frigateManager,
    controllers: FrigateController(gladys, frigateManager),
  });
};
