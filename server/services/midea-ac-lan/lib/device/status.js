const { DEVICE_FEATURE_TYPES } = require('../../../../utils/constants');
const { statusToFeatureValues } = require('../midea-ac-lan.mapper');
const logger = require('../../../../utils/logger');

/**
 * @description Publish device status to Gladys features.
 * @param {object} device - The device to update.
 * @param {object} status - The device status to publish.
 * @example
 * publishStatus(device, { power: true, targetTemperature: 22 });
 */
async function publishStatus(device, status) {
    try {
        // Convert raw status to Gladys feature values
        const v = statusToFeatureValues(status);
        const features = await this.gladys.device.getBySelector(device.selector);

        const push = async (type, value) => {
            if (value === null || value === undefined) return;
            const feat = features.features.find((f) => f.type === type);
            if (!feat) return;
            await this.gladys.device.setValue(feat, value);
        };

        // Update power state
        await push(DEVICE_FEATURE_TYPES.AIR_CONDITIONING.BINARY, v.power ? 1 : 0);

        // Update target temperature
        await push(DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE, v.targetTemperature);

        // Update mode
        await push(DEVICE_FEATURE_TYPES.AIR_CONDITIONING.MODE, v.mode);

        // Update current temperature
        await push('temperature', v.currentTemperature);

        logger.debug(`Midea AC LAN: Published status for ${device.name}: power=${v.power}, temp=${v.targetTemperature}°C, mode=${v.mode}`);

    } catch (error) {
        logger.error(`Midea AC LAN: Error publishing status for ${device.name}: ${error.message}`);
        throw error;
    }
}

/**
 * @description Get current device status from stored client data.
 * @param {object} device - The device to get status for.
 * @returns {object|null} Current device status or null if not available.
 * @example
 * const status = getStatus(device);
 */
function getStatus(device) {
    const external_id = device.external_id;
    const client = this.clients.get(external_id);

    if (!client || !client.connected) {
        return null;
    }

    return client.lastStatus;
}

module.exports = {
    publishStatus,
    getStatus,
};
