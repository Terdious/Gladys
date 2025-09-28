const net = require('net');
const crypto = require('crypto');
const logger = require('../../../../utils/logger');

/**
 * Midea TCP Protocol v3 (Security v3)
 * Port: 6444
 * Basé sur wuwentao/midea_ac_lan
 */

class MideaProtocol {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.security = null;
    }

    /**
     * Connexion et handshake v3 avec l'appareil
     * @param {string} host - Adresse IP de l'appareil
     * @param {number} port - Port TCP (défaut: 6444)
     * @param {string} token - Token obtenu du cloud
     * @param {string} key - Clé obtenue du cloud
     * @returns {Promise<boolean>} Succès de la connexion
     */
    async connect(host, port = 6444, token, key) {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            this.socket.setTimeout(5000);

            this.socket.on('connect', async () => {
                logger.debug(`Midea Protocol: Connected to ${host}:${port}`);
                try {
                    const success = await this.performHandshake(token, key);
                    this.connected = success;
                    resolve(success);
                } catch (e) {
                    logger.error(`Midea Protocol: Handshake failed: ${e.message}`);
                    this.disconnect();
                    reject(e);
                }
            });

            this.socket.on('error', (err) => {
                logger.error(`Midea Protocol: Socket error: ${err.message}`);
                this.connected = false;
                reject(err);
            });

            this.socket.on('timeout', () => {
                logger.error(`Midea Protocol: Connection timeout to ${host}:${port}`);
                this.disconnect();
                reject(new Error('Connection timeout'));
            });

            logger.debug(`Midea Protocol: Connecting to ${host}:${port}`);
            this.socket.connect(port, host);
        });
    }

    /**
     * Effectue le handshake de sécurité v3
     * @param {string} token - Token du cloud
     * @param {string} key - Clé du cloud
     * @returns {Promise<boolean>} Succès du handshake
     */
    async performHandshake(token, key) {
        // Étape 1: Envoyer le paquet d'authentification
        const authPacket = this.buildAuthPacket(token, key);
        await this.sendPacket(authPacket);

        // Étape 2: Recevoir la réponse d'authentification
        const response = await this.receivePacket();

        // Étape 3: Valider la réponse et établir la sécurité
        return this.validateAuthResponse(response, token, key);
    }

    /**
     * Construit le paquet d'authentification
     * @param {string} token - Token du cloud
     * @param {string} key - Clé du cloud
     * @returns {Buffer} Paquet d'authentification
     */
    buildAuthPacket(token, key) {
        // Paquet d'authentification v3 (basé sur HA)
        const packet = Buffer.alloc(72);

        // Header
        packet[0] = 0x5a;
        packet[1] = 0x5a;
        packet[2] = 0x01;
        packet[3] = 0x11;
        packet.writeUInt16LE(72, 4); // Longueur du paquet

        // Type de commande (authentification)
        packet[10] = 0x99;

        // Token (32 bytes)
        const tokenBuffer = Buffer.from(token, 'hex');
        tokenBuffer.copy(packet, 12, 0, Math.min(32, tokenBuffer.length));

        // Signature/checksum
        const checksum = this.calculateChecksum(packet.slice(0, 68));
        packet.writeUInt32LE(checksum, 68);

        logger.debug(`Midea Protocol: Built auth packet (${packet.length} bytes)`);
        return packet;
    }

    /**
     * Valide la réponse d'authentification
     * @param {Buffer} response - Réponse reçue
     * @param {string} token - Token utilisé
     * @param {string} key - Clé utilisée
     * @returns {boolean} Succès de l'authentification
     */
    validateAuthResponse(response, token, key) {
        if (!response || response.length < 72) {
            logger.error('Midea Protocol: Invalid auth response length');
            return false;
        }

        // Vérifier le header
        if (response[0] !== 0x5a || response[1] !== 0x5a) {
            logger.error('Midea Protocol: Invalid auth response header');
            return false;
        }

        // Vérifier le code de réponse
        const responseCode = response[10];
        if (responseCode !== 0x01) {
            logger.error(`Midea Protocol: Auth failed with code: 0x${responseCode.toString(16)}`);
            return false;
        }

        // Initialiser la sécurité pour les communications futures
        this.security = {
            token: Buffer.from(token, 'hex'),
            key: Buffer.from(key, 'hex')
        };

        logger.info('Midea Protocol: Authentication successful');
        return true;
    }

    /**
     * Envoie un paquet de données
     * @param {Buffer} packet - Paquet à envoyer
     * @returns {Promise<void>}
     */
    async sendPacket(packet) {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.socket.writable) {
                reject(new Error('Socket not writable'));
                return;
            }

            this.socket.write(packet, (err) => {
                if (err) {
                    reject(err);
                } else {
                    logger.debug(`Midea Protocol: Sent packet (${packet.length} bytes)`);
                    resolve();
                }
            });
        });
    }

    /**
     * Reçoit un paquet de données
     * @returns {Promise<Buffer>} Paquet reçu
     */
    async receivePacket() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Receive timeout'));
            }, 5000);

            const onData = (data) => {
                clearTimeout(timeout);
                this.socket.off('data', onData);
                logger.debug(`Midea Protocol: Received packet (${data.length} bytes)`);
                resolve(data);
            };

            this.socket.on('data', onData);
        });
    }

    /**
     * Calcule le checksum d'un paquet
     * @param {Buffer} data - Données à vérifier
     * @returns {number} Checksum
     */
    calculateChecksum(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        return sum & 0xFFFFFFFF;
    }

    /**
     * Envoie une commande de récupération des capacités
     * @returns {Promise<object>} Capacités de l'appareil
     */
    async getCapabilities() {
        if (!this.connected || !this.security) {
            throw new Error('Not authenticated');
        }

        // Paquet de demande des capacités
        const capPacket = this.buildCapabilitiesPacket();
        await this.sendPacket(capPacket);

        // Recevoir la réponse
        const response = await this.receivePacket();
        return this.parseCapabilitiesResponse(response);
    }

    /**
     * Construit le paquet de demande des capacités
     * @returns {Buffer} Paquet de demande
     */
    buildCapabilitiesPacket() {
        const packet = Buffer.alloc(48);

        // Header
        packet[0] = 0x5a;
        packet[1] = 0x5a;
        packet[2] = 0x01;
        packet[3] = 0x11;
        packet.writeUInt16LE(48, 4);

        // Type de commande (get capabilities)
        packet[10] = 0xB5;

        // Checksum
        const checksum = this.calculateChecksum(packet.slice(0, 44));
        packet.writeUInt32LE(checksum, 44);

        return packet;
    }

    /**
     * Parse la réponse des capacités
     * @param {Buffer} response - Réponse reçue
     * @returns {object} Capacités parsées
     */
    parseCapabilitiesResponse(response) {
        // Parsing basique - à adapter selon les besoins
        return {
            model: 'Unknown',
            capabilities: [],
            firmware: 'Unknown',
            raw: response.toString('hex')
        };
    }

    /**
     * Récupère le statut de l'appareil
     * @returns {Promise<object>} Statut de l'appareil
     */
    async getStatus() {
        if (!this.connected || !this.security) {
            throw new Error('Not authenticated');
        }

        // Paquet de demande de statut
        const statusPacket = this.buildStatusPacket();
        await this.sendPacket(statusPacket);

        // Recevoir la réponse
        const response = await this.receivePacket();
        return this.parseStatusResponse(response);
    }

    /**
     * Construit le paquet de demande de statut
     * @returns {Buffer} Paquet de demande
     */
    buildStatusPacket() {
        const packet = Buffer.alloc(48);

        // Header
        packet[0] = 0x5a;
        packet[1] = 0x5a;
        packet[2] = 0x01;
        packet[3] = 0x11;
        packet.writeUInt16LE(48, 4);

        // Type de commande (get status)
        packet[10] = 0x41;

        // Checksum
        const checksum = this.calculateChecksum(packet.slice(0, 44));
        packet.writeUInt32LE(checksum, 44);

        return packet;
    }

    /**
     * Parse la réponse de statut
     * @param {Buffer} response - Réponse reçue
     * @returns {object} Statut parsé
     */
    parseStatusResponse(response) {
        // Parsing basique - à adapter selon les besoins
        return {
            power: false,
            temperature: 20,
            mode: 'auto',
            fanSpeed: 'auto',
            raw: response.toString('hex')
        };
    }

    /**
     * Ferme la connexion
     */
    disconnect() {
        this.connected = false;
        this.security = null;

        if (this.socket) {
            try {
                this.socket.destroy();
            } catch (e) {
                // Ignore les erreurs de fermeture
            }
            this.socket = null;
        }

        logger.debug('Midea Protocol: Disconnected');
    }
}

module.exports = { MideaProtocol };
