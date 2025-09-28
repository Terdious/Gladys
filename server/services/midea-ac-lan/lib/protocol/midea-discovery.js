const dgram = require('dgram');
const logger = require('../../../../utils/logger');

/**
 * Midea UDP Discovery Protocol
 * Port: 6445 (broadcast)
 * Basé sur wuwentao/midea_ac_lan
 */

class MideaDiscovery {
    constructor() {
        this.socket = null;
        this.devices = new Map();
    }

    /**
     * Découverte UDP broadcast sur port 6445
     * @param {string} broadcastAddress - Adresse de broadcast (ex: 10.5.0.255)
     * @param {number} timeout - Timeout en ms (défaut: 3000)
     * @returns {Promise<Array>} Liste des appareils découverts
     */
    async discover(broadcastAddress = '255.255.255.255', timeout = 3000) {
        return new Promise((resolve, reject) => {
            this.devices.clear();
            this.socket = dgram.createSocket('udp4');

            // Paquet de découverte Midea (basé sur HA)
            const discoveryPacket = new Buffer(80);
            const discoveryData = [
                0x5a, 0x5a, 0x01, 0x11, 0x48, 0x00, 0x92, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x7f, 0x75, 0xb0, 0x1b, 0x52, 0x72, 0x03, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ];
            for (let i = 0; i < discoveryData.length; i++) {
                discoveryPacket[i] = discoveryData[i];
            }

            this.socket.on('error', (err) => {
                logger.error(`Midea Discovery UDP error: ${err.message}`);
                this.cleanup();
                reject(err);
            });

            this.socket.on('message', (msg, rinfo) => {
                try {
                    const device = this.parseDiscoveryResponse(msg, rinfo);
                    if (device) {
                        this.devices.set(device.id, device);
                        logger.debug(`Midea Discovery: Found device ${device.id} at ${device.host}:${device.port}`);
                    }
                } catch (e) {
                    logger.debug(`Midea Discovery: Failed to parse response from ${rinfo.address}: ${e.message}`);
                }
            });

            this.socket.bind(() => {
                this.socket.setBroadcast(true);

                logger.info(`Midea Discovery: Broadcasting to ${broadcastAddress}:6445`);
                this.socket.send(discoveryPacket, 6445, broadcastAddress, (err) => {
                    if (err) {
                        logger.error(`Midea Discovery: Broadcast failed: ${err.message}`);
                        this.cleanup();
                        reject(err);
                        return;
                    }

                    // Attendre les réponses
                    setTimeout(() => {
                        this.cleanup();
                        const deviceList = Array.from(this.devices.values());
                        logger.info(`Midea Discovery: Found ${deviceList.length} device(s)`);
                        resolve(deviceList);
                    }, timeout);
                });
            });
        });
    }

    /**
     * Parse la réponse UDP de découverte
     * @param {Buffer} buffer - Données reçues
     * @param {object} rinfo - Informations de l'expéditeur
     * @returns {object|null} Informations de l'appareil ou null
     */
    parseDiscoveryResponse(buffer, rinfo) {
        if (buffer.length < 104) {
            return null;
        }

        // Vérification du header Midea
        if (buffer[0] !== 0x5a || buffer[1] !== 0x5a) {
            return null;
        }

        // Extraction des données (basé sur le protocole HA)
        const id = buffer.readBigUInt64LE(20);
        const port = buffer.readUInt16LE(8);
        const sn = buffer.slice(32, 40).toString('hex');
        const ssid = buffer.slice(41, 73).toString('utf8').replace(/\0/g, '');

        // Type et sous-type
        const type = buffer.readUInt8(72);
        const subtype = buffer.readUInt8(73);

        // Version firmware
        const fw_major = buffer.readUInt8(74);
        const fw_minor = buffer.readUInt8(75);
        const fw_patch = buffer.readUInt8(76);
        const fw = `${fw_major}.${fw_minor}.${fw_patch}`;

        // Génération de l'UDP ID (utilisé pour l'authentification)
        const udpId = this.generateUdpId(buffer);

        // Mapping des types d'appareils (basé sur HA)
        const deviceTypes = {
            0xAC: 'Air Conditioner',
            0xA1: 'Dehumidifier',
            0xC3: 'Heat Pump Wi-Fi Controller',
            0xCC: 'MDV Wi-Fi Controller',
            0xCF: 'Air Conditioner',
            0xFB: 'Electric Heater'
        };

        return {
            id: Number(id),
            host: rinfo.address,
            port: port || 6444,
            sn,
            ssid,
            type: deviceTypes[type] || `Unknown (0x${type.toString(16)})`,
            subtype,
            fw,
            udpId,
            raw: buffer.toString('hex')
        };
    }

    /**
     * Génère l'UDP ID utilisé pour l'authentification
     * @param {Buffer} buffer - Données de découverte
     * @returns {string} UDP ID en hexadécimal
     */
    generateUdpId(buffer) {
        // Basé sur l'implémentation HA - utilise une partie des données de découverte
        const relevant = buffer.slice(20, 40);
        return relevant.toString('hex');
    }

    /**
     * Nettoie les ressources
     */
    cleanup() {
        if (this.socket) {
            try {
                this.socket.close();
            } catch (e) {
                // Ignore les erreurs de fermeture
            }
            this.socket = null;
        }
    }
}

module.exports = { MideaDiscovery };
