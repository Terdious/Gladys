const { MideaDiscovery } = require('./midea-discovery');
const { MideaProtocol } = require('./midea-protocol');
const logger = require('../../../../utils/logger');

/**
 * Client Midea complet
 * Combine découverte UDP + authentification cloud + communication locale
 */

class MideaClient {
    constructor(cloudClient) {
        this.cloudClient = cloudClient;
        this.discovery = new MideaDiscovery();
        this.protocol = new MideaProtocol();
    }

    /**
     * Découverte complète avec enrichissement cloud
     * @param {string} subnet - Sous-réseau CIDR (ex: "10.5.0.0/24")
     * @returns {Promise<Array>} Liste des appareils avec token/key
     */
    async discoverDevices(subnet) {
        logger.info(`Midea Client: Starting discovery on ${subnet}`);

        // 1. Conversion CIDR vers broadcast
        const broadcastAddress = this.cidrToBroadcast(subnet);

        // 2. Découverte UDP
        const devices = await this.discovery.discover(broadcastAddress);
        logger.info(`Midea Client: Found ${devices.length} device(s) via UDP`);

        // 3. Enrichissement avec token/key du cloud
        for (const device of devices) {
            try {
                await this.enrichDeviceWithCloud(device);
            } catch (e) {
                logger.warn(`Midea Client: Failed to get cloud credentials for ${device.id}: ${e.message}`);
            }
        }

        return devices;
    }

    /**
     * Enrichit un appareil avec les credentials du cloud
     * @param {object} device - Appareil découvert
     */
    async enrichDeviceWithCloud(device) {
        if (!this.cloudClient) {
            logger.warn('Midea Client: No cloud client available');
            return;
        }

        try {
            // Utiliser notre système cloud existant (MSmartHome)
            const credentials = await this.cloudClient.rawGetToken({ accessToken: this.cloudClient._accessToken, udpId: device.udpId, deviceId: device.id });

            if (credentials && credentials.token && credentials.key) {
                device.token = credentials.token;
                device.key = credentials.key;
                logger.info(`Midea Client: Got cloud credentials for device ${device.id}`);
            } else {
                logger.warn(`Midea Client: Empty credentials for device ${device.id}`);
            }
        } catch (e) {
            logger.error(`Midea Client: Cloud auth failed for device ${device.id}: ${e.message}`);
            throw e;
        }
    }

    /**
     * Connexion complète à un appareil (handshake + capacités)
     * @param {object} device - Appareil avec token/key
     * @returns {Promise<object>} Informations complètes de l'appareil
     */
    async connectToDevice(device) {
        if (!device.token || !device.key) {
            throw new Error('Device missing token or key');
        }

        logger.info(`Midea Client: Connecting to device ${device.id} at ${device.host}:${device.port}`);

        // 1. Connexion et handshake
        await this.protocol.connect(device.host, device.port, device.token, device.key);

        // 2. Récupération des capacités
        const capabilities = await this.protocol.getCapabilities();

        // 3. Enrichissement des informations
        device.capabilities = capabilities;
        device.model = capabilities.model || 'Unknown';
        device.connected = true;

        logger.info(`Midea Client: Successfully connected to device ${device.id}`);
        return device;
    }

    /**
     * Déconnexion d'un appareil
     */
    disconnect() {
        if (this.protocol) {
            this.protocol.disconnect();
        }
        if (this.discovery) {
            this.discovery.cleanup();
        }
    }

    /**
     * Convertit un CIDR en adresse de broadcast
     * @param {string} cidr - Notation CIDR (ex: "10.5.0.0/24")
     * @returns {string} Adresse de broadcast
     */
    cidrToBroadcast(cidr) {
        const [network, prefixLength] = cidr.split('/');
        const prefix = parseInt(prefixLength, 10);

        if (prefix < 0 || prefix > 32) {
            throw new Error('Invalid CIDR prefix length');
        }

        const networkParts = network.split('.').map(Number);
        const hostBits = 32 - prefix;
        const hostMask = (1 << hostBits) - 1;

        // Calcul de l'adresse de broadcast
        let networkInt = (networkParts[0] << 24) | (networkParts[1] << 16) | (networkParts[2] << 8) | networkParts[3];
        const broadcastInt = networkInt | hostMask;

        const broadcast = [
            (broadcastInt >>> 24) & 0xFF,
            (broadcastInt >>> 16) & 0xFF,
            (broadcastInt >>> 8) & 0xFF,
            broadcastInt & 0xFF
        ].join('.');

        logger.debug(`Midea Client: CIDR ${cidr} -> Broadcast ${broadcast}`);
        return broadcast;
    }

    /**
     * Test de connectivité TCP vers un appareil
     * @param {string} host - Adresse IP
     * @param {number} port - Port TCP
     * @returns {Promise<boolean>} Appareil accessible
     */
    async testConnectivity(host, port = 6444) {
        return new Promise((resolve) => {
            const net = require('net');
            const socket = new net.Socket();

            socket.setTimeout(2000);

            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });

            socket.on('error', () => {
                resolve(false);
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });

            socket.connect(port, host);
        });
    }
}

module.exports = { MideaClient };
