const logger = require('../../utils/logger');
const MideaAcLanController = require('./api/midea-ac-lan.controller');
const MideaAcLanHandler = require('./lib');
const { STATUS } = require('./lib/utils/midea-ac-lan.constants');

module.exports = function MideaAcLanService(gladys, serviceId) {
  const mideaAcLanHandler = new MideaAcLanHandler(gladys, serviceId);

  /**
   * @public
   * @description This function starts service.
   * @example
   * gladys.services.midea-ac-lan.start();
   */
  async function start() {
    logger.info('Midea AC LAN: starting service');
    await mideaAcLanHandler.init();
  }

  /**
   * @public
   * @description This function stops the service.
   * @example
   *  gladys.services.midea-ac-lan.stop();
   */
  async function stop() {
    logger.info('Stopping Midea AC LAN service');
    await mideaAcLanHandler.disconnect();
  }

  /**
   * @public
   * @description Test if Netatmo is running.
   * @returns {Promise<boolean>} Returns true if Netatmo is used.
   * @example
   *  const used = await gladys.services.netatmo.isUsed();
   */
  async function isUsed() {
    return mideaAcLanHandler.status === STATUS.CONNECTED;
  }

  return Object.freeze({
    start,
    stop,
    isUsed,
    device: mideaAcLanHandler,
    controllers: MideaAcLanController(mideaAcLanHandler),
  });
};
