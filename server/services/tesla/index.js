const logger = require('../../utils/logger');
const teslaController = require('./api/tesla.controller');

const TeslaHandler = require('./lib');
const { STATUS } = require('./lib/utils/tesla.constants');

module.exports = function TeslaService(gladys, serviceId) {
    const teslaHandler = new TeslaHandler(gladys, serviceId);

    /**
     * @public
     * @description This function starts service.
     * @example
     * gladys.services.tesla.start();
     */
    async function start() {
        logger.info('Starting Tesla service', serviceId);
        await teslaHandler.init();
    }

    /**
     * @public
     * @description This function stops the service.
     * @example
     *  gladys.services.tesla.stop();
     */
    async function stop() {
        logger.info('Stopping Tesla service');
        await teslaHandler.disconnect();
    }

    /**
     * @public
     * @description Test if Tesla is running.
     * @returns {Promise<boolean>} Returns true if Tesla is used.
     * @example
     *  const used = await gladys.services.tesla.isUsed();
     */
    async function isUsed() {
        return teslaHandler.status === STATUS.CONNECTED;
    }

    return Object.freeze({
        start,
        stop,
        isUsed,
        device: teslaHandler,
        controllers: teslaController(teslaHandler),
    });
}; 