const logger = require('../../../../utils/logger');

/**
 * @description Connect to a Midea device and establish persistent connection.
 * @param {object} device - The Gladys device to connect to.
 * @param {object} credentials - Device connection credentials.
 * @param {string} credentials.id - Device ID.
 * @param {string} credentials.key - Device key.
 * @param {string} credentials.token - Device token.
 * @param {string} credentials.host - Device IP address.
 * @param {number} credentials.port - Device port (default: 6444).
 * @example
 * connect(device, { id: '123', key: 'abc', token: 'xyz', host: '192.168.1.100' });
 */
async function connect(device, { id, key, token, host, port = 6444 }) {
    const external_id = device.external_id;

    // Clean up existing connection if any
    if (this.clients.has(external_id)) {
        const c = this.clients.get(external_id);
        if (c.interval) clearInterval(c.interval);
        logger.debug(`Midea AC LAN: Cleaned up existing connection for ${device.name}`);
    }

    // TEMPORAIREMENT DÉSACTIVÉ - MideaProtocol supprimé
    // TODO: Implémenter le contrôle local avec node-mideahvac ou protocole UDP
    logger.warn(`Midea AC LAN: Device connection temporarily disabled for ${device.name} (${host}:${port})`);
    logger.info(`Midea AC LAN: Device registered but polling/control not active yet`);

    // Store device information for future use
    this.clients.set(external_id, {
        device,
        id,
        key,
        token,
        host,
        port,
        connected: false, // Indicates connection is not active
        lastStatus: null, // Last known status
        lastUpdate: null  // Last update timestamp
    });

    logger.info(`Midea AC LAN: Device ${device.name} information stored for future connection`);
}

module.exports = {
    connect,
};
