// const logger = require('../../../utils/logger');
// const { MideaClient } = require('./protocol/midea-client');
// const { scanHosts } = require('./midea-ac-lan.scanHosts');

// /**
//  * Découverte Midea avec implémentation pure JavaScript
//  * Remplace node-mideahvac par notre propre protocole
//  */

// async function discover(params) {
//     const { target = '10.5.0.0/24', user, password } = params || {};

//     logger.info(`Midea AC LAN (Pure JS): Starting discovery on ${target}`);

//     // 1. Vérifier l'authentification cloud
//     const cloudClient = await this.ensureCloudClient();
//     if (!cloudClient || !cloudClient._accessToken) {
//         if (user && password) {
//             logger.info('Midea AC LAN (Pure JS): Authenticating with cloud...');
//             await this.connectCloud({ user, password });
//             // Récupérer le client après authentification
//             const newCloudClient = await this.ensureCloudClient();
//             if (!newCloudClient || !newCloudClient._accessToken) {
//                 throw new Error('Cloud authentication failed');
//             }
//         } else {
//             throw new Error('Cloud authentication required - please login first');
//         }
//     }

//     // 2. Créer le client Midea avec notre cloud
//     const mideaClient = new MideaClient(cloudClient);

//     try {
//         // 3. Découverte complète (UDP + Cloud enrichment)
//         const devices = await mideaClient.discoverDevices(target);

//         // 4. Test de connectivité et enrichissement local
//         const enrichedDevices = [];

//         for (const device of devices) {
//             try {
//                 // Test de connectivité TCP
//                 const reachable = await mideaClient.testConnectivity(device.host, device.port);
//                 if (!reachable) {
//                     logger.warn(`Midea AC LAN (Pure JS): Device ${device.id} not reachable at ${device.host}:${device.port}`);
//                     continue;
//                 }

//                 // Si on a token/key, essayer la connexion complète
//                 if (device.token && device.key) {
//                     try {
//                         const connectedDevice = await mideaClient.connectToDevice(device);
//                         enrichedDevices.push(connectedDevice);
//                         logger.info(`Midea AC LAN (Pure JS): Successfully connected to ${device.id}`);
//                     } catch (e) {
//                         logger.warn(`Midea AC LAN (Pure JS): Failed to connect to ${device.id}: ${e.message}`);
//                         // Ajouter quand même l'appareil sans les capacités
//                         enrichedDevices.push(device);
//                     }
//                 } else {
//                     // Ajouter l'appareil même sans credentials
//                     enrichedDevices.push(device);
//                     logger.info(`Midea AC LAN (Pure JS): Found device ${device.id} but no cloud credentials`);
//                 }

//             } catch (e) {
//                 logger.error(`Midea AC LAN (Pure JS): Error processing device ${device.id}: ${e.message}`);
//             }
//         }

//         // 5. Fallback: scan TCP si aucun appareil trouvé via UDP
//         if (enrichedDevices.length === 0) {
//             logger.info('Midea AC LAN (Pure JS): No devices found via UDP, trying TCP scan...');
//             const tcpHosts = await scanHosts.call(this, { subnet: target, port: 6444 });

//             for (const host of tcpHosts) {
//                 enrichedDevices.push({
//                     id: null,
//                     host: host.host,
//                     port: host.port,
//                     type: 'Unknown (TCP scan)',
//                     subtype: 0,
//                     fw: 'Unknown',
//                     udpId: null,
//                     token: null,
//                     key: null,
//                     source: 'tcp_scan',
//                     rawUdpResponse: null
//                 });
//             }
//         }

//         logger.info(`Midea AC LAN (Pure JS): Discovery completed - found ${enrichedDevices.length} device(s)`);
//         return enrichedDevices;

//     } finally {
//         // Nettoyer les ressources
//         mideaClient.disconnect();
//     }
// }

// /**
//  * Confirmation d'un appareil spécifique (pour le bouton "Récupérer Token/Key")
//  */
// async function confirmDevice({ id, udpId, host }) {
//     logger.info(`Midea AC LAN (Pure JS): Confirming device ${id} at ${host}`);

//     if (!host) {
//         throw new Error('HOST_REQUIRED');
//     }

//     // 1. Vérifier l'authentification cloud
//     const cloudClient = await this.ensureCloudClient();
//     if (!cloudClient || !cloudClient._accessToken) {
//         throw new Error('CLOUD_AUTH_REQUIRED');
//     }

//     // 2. Créer le client Midea
//     const mideaClient = new MideaClient(cloudClient);

//     try {
//         // 3. Test de connectivité
//         const reachable = await mideaClient.testConnectivity(host, 6444);
//         if (!reachable) {
//             throw new Error('DEVICE_UNREACHABLE');
//         }

//         // 4. Récupérer les credentials du cloud
//         let token, key;
//         try {
//             const credentials = await cloudClient.rawGetToken({ accessToken: cloudClient._accessToken, udpId, deviceId: id });
//             if (!credentials || !credentials.token || !credentials.key) {
//                 throw new Error('EMPTY_CREDENTIALS');
//             }
//             token = credentials.token;
//             key = credentials.key;
//             logger.info(`Midea AC LAN (Pure JS): Got cloud credentials for ${id}`);
//         } catch (e) {
//             logger.error(`Midea AC LAN (Pure JS): Failed to get cloud credentials: ${e.message}`);
//             throw new Error('CLOUD_CREDENTIALS_FAILED');
//         }

//         // 5. Connexion locale et récupération des capacités
//         let model = 'Unknown';
//         let capabilities = {};

//         try {
//             await mideaClient.protocol.connect(host, 6444, token, key);
//             const caps = await mideaClient.protocol.getCapabilities();
//             model = caps.model || 'Unknown';
//             capabilities = caps;
//             logger.info(`Midea AC LAN (Pure JS): Successfully connected and got capabilities for ${id}`);
//         } catch (e) {
//             logger.warn(`Midea AC LAN (Pure JS): Local connection failed, but cloud credentials OK: ${e.message}`);
//             // Continuer avec les credentials du cloud seulement
//         }

//         return {
//             id,
//             host,
//             port: 6444,
//             token,
//             key,
//             model,
//             capabilities,
//             protocol: 'v3',
//             source: 'pure_js'
//         };

//     } finally {
//         mideaClient.disconnect();
//     }
// }

// module.exports = {
//     discover,
//     confirmDevice
// };
