const logger = require('../../../utils/logger');

/**
 * @description List all configured Midea devices.
 * @returns {Array} List of configured devices.
 * @example
 * const devices = await listDevices();
 */
async function listDevices() {
    try {
        // Get all devices for this service using the correct API
        const devices = await this.gladys.device.get({ service: 'midea-ac-lan' });

        // Filter and format Midea devices
        const mideaDevices = devices
            .filter(device => device.external_id && device.external_id.startsWith('midea-ac-lan:'))
            .map(device => {
                // Convert params array to object
                const paramsObj = {};
                if (device.params && Array.isArray(device.params)) {
                    device.params.forEach(param => {
                        paramsObj[param.name] = param.value;
                    });
                }

                return {
                    id: device.id,
                    name: device.name,
                    external_id: device.external_id,
                    selector: device.selector,
                    model: device.model || 'Unknown',
                    room_id: device.room_id,
                    features: device.features || [],
                    // Get device parameters from the converted object
                    params: {
                        MIDEA_ID: paramsObj.MIDEA_ID,
                        MIDEA_HOST: paramsObj.MIDEA_HOST,
                        MIDEA_PORT: paramsObj.MIDEA_PORT,
                        MIDEA_KEY: paramsObj.MIDEA_KEY,
                        MIDEA_TOKEN: paramsObj.MIDEA_TOKEN,
                        MIDEA_MODEL: paramsObj.MIDEA_MODEL,
                        MIDEA_TYPE: paramsObj.MIDEA_TYPE,
                        MIDEA_FW: paramsObj.MIDEA_FW,
                        MIDEA_SUBTYPE: paramsObj.MIDEA_SUBTYPE,
                        MIDEA_UDPID: paramsObj.MIDEA_UDPID,
                    }
                };
            });

        logger.debug(`Midea AC LAN: Found ${mideaDevices.length} configured devices`);
        return mideaDevices;

    } catch (error) {
        logger.error(`Midea AC LAN: Error listing devices: ${error.message}`);
        throw error;
    }
}

module.exports = {
    listDevices,
};