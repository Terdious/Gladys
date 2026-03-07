const logger = require('../../utils/logger');
const zendureController = require('./api/zendure.controller');

const ZendureHandler = require('./lib');
const { STATUS } = require('./lib/utils/zendure.constants');

module.exports = function ZendureService(gladys, serviceId) {
  const mqtt = require('mqtt');
  const zendureHandler = new ZendureHandler(gladys, mqtt, serviceId);

  /**
   * @public
   * @description This function starts service.
   * @example
   * gladys.services.zendure.start();
   */
  async function start() {
    logger.info('Starting Zendure service', serviceId);
    await zendureHandler.init();
  }

  /**
   * @public
   * @description This function stops the service.
   * @example
   * gladys.services.zendure.stop();
   */
  async function stop() {
    logger.info('Stopping Zendure service');
    zendureHandler.disconnectMqtt();
  }

  /**
   * @public
   * @description Test if Zendure is running.
   * @returns {Promise<boolean>} Returns true if Zendure is used.
   * @example
   * const used = await gladys.services.zendure.isUsed();
   */
  async function isUsed() {
    return zendureHandler.status === STATUS.CONNECTED;
  }

  return Object.freeze({
    start,
    stop,
    isUsed,
    device: zendureHandler,
    controllers: zendureController(zendureHandler),
  });
};
