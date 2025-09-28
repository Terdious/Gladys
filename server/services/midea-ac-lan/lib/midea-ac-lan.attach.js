// const appliances = require('node-mideahvac'); // Remplacé par notre implémentation pure JS
const { MideaProtocol } = require('./protocol/midea-protocol');
const logger = require('../../../utils/logger');
const { statusToFeatureValues } = require('./midea-ac-lan.mapper');
const { DEVICE_FEATURE_TYPES } = require('../../../utils/constants');

async function _attach(device, { id, key, token, host, port = 6444 }) {
    const external_id = device.external_id;
    if (this.clients.has(external_id)) {
        const c = this.clients.get(external_id);
        if (c.interval) clearInterval(c.interval);
    }
    // Créer une connexion avec notre implémentation pure JS
    const protocol = new MideaProtocol();
    await protocol.connect(host, port, token, key);
    const ac = { protocol, getStatus: () => protocol.getStatus() };

    const poll = async () => {
        try {
            // @ts-ignore – ESM types not present
            const st = await ac.getStatus();
            await this._publishStatus(device, st);
        } catch (e) {
            logger.debug(`Midea poll error for ${device.name}: ${e.message}`);
        }
    };

    await poll();
    const interval = setInterval(poll, 30000);
    this.clients.set(external_id, { ac, interval });
}

async function _publishStatus(device, status) {
    const v = statusToFeatureValues(status);
    const features = await this.gladys.device.getBySelector(device.selector);

    const push = async (type, value) => {
        if (value === null || value === undefined) return;
        const feat = features.features.find((f) => f.type === type);
        if (!feat) return;
        await this.gladys.device.setValue(feat, value);
    };

    await push(DEVICE_FEATURE_TYPES.AIR_CONDITIONING.BINARY, v.power ? 1 : 0);
    await push(DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE, v.targetTemperature);
    await push(DEVICE_FEATURE_TYPES.AIR_CONDITIONING.MODE, v.mode);
    await push('temperature', v.currentTemperature);
}

module.exports = { _attach, _publishStatus };


