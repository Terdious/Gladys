// const appliances = require('node-mideahvac'); // Remplacé par notre implémentation pure JS
const net = require('net');
const logger = require('../../../utils/logger');
const { buildFeaturesForAc } = require('./midea-ac-lan.mapper');
const { deviceExternalIdFrom } = require('./utils/midea-ac-lan.utils');

async function retry(fn, { retries = 2, minTimeout = 200 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            if (attempt === retries) break;
            const delay = minTimeout * Math.pow(2, attempt);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastError;
}

async function saveDevice({ id, name, host, port = 6444, key, token }) {
    const external_id = deviceExternalIdFrom({ id });

    // 1) Reachability probe on TCP 6444 before creating the device
    if (!host) {
        throw new Error('HOST_REQUIRED');
    }
    const reachable = await new Promise((resolve) => {
        const socket = net.createConnection({ host, port, timeout: 1500 }, () => {
            socket.end();
            resolve(true);
        });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
    if (!reachable) {
        throw new Error('HOST_UNREACHABLE');
    }

    let cap = {};
    if (false && key && token) { // TEMPORAIREMENT DÉSACTIVÉ - getCapabilities timeout
        try {
            // Utiliser notre implémentation pure JavaScript
            const { MideaProtocol } = require('./protocol/midea-protocol');
            const protocol = new MideaProtocol();

            await protocol.connect(host, port, token, key);
            cap = await protocol.getCapabilities();
            protocol.disconnect();

            logger.info(`Midea AC LAN: getCapabilities succeeded for ${id}`);
        } catch (e) {
            logger.warn(`Midea AC LAN: getCapabilities failed for ${id}: ${e.message}`);
            cap = {};
        }
    }

    // FALLBACK: Capacités par défaut pour Heat Pump Wi-Fi Controller (C3)
    cap = {
        model: 'Heat Pump Wi-Fi Controller',
        type: 'C3',
        protocol: 3,
        // Capacités de base pour une PAC
        supports_heating: true,
        supports_cooling: true,
        supports_dhw: true,
        supports_zones: true
    };
    // Build features using Gladys categories/types
    const rawFeatures = buildFeaturesForAc(cap);
    // Ensure required fields and external_id for each feature
    const features = rawFeatures.map((f) => ({
        ...f,
        has_feedback: typeof f.has_feedback === 'boolean' ? f.has_feedback : false,
        min: typeof f.min === 'number' ? f.min : 0,
        max: typeof f.max === 'number' ? f.max : 0,
        external_id: `${external_id}:${f.type}`
    }));

    const device = await this.gladys.device.create({
        name: name || `Midea AC ${id}`,
        service_id: this.serviceId,
        external_id,
        selector: external_id,
        model: 'Midea AC (LAN)',
        features,
    });

    // Enregistrer en DeviceParam liés au device (pas en variables globales de service)
    const setParam = async (name, value) => {
        if (value === undefined || value === null || value === '') return;
        await this.gladys.device.setParam(device, name, String(value));
    };
    await setParam('MIDEA_ID', id);
    await setParam('MIDEA_HOST', host);
    await setParam('MIDEA_PORT', String(port));
    await setParam('MIDEA_KEY', key);
    await setParam('MIDEA_TOKEN', token);

    if (host && key && token) {
        await this._attach(device, { id, key, token, host, port });
    }
    const mask = (v) => (v ? `${String(v).slice(0, 2)}***${String(v).slice(-2)}` : v);
    return {
        device,
        source: { id, name, host, port, key: mask(key), token: mask(token) },
        capabilities: cap,
        features
    };
}

module.exports = { saveDevice };


