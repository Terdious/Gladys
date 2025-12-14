// const CloudConnection = require('node-mideahvac/lib/cloud.js');
// const logger = require('../../../utils/logger');

// /**
//  * Ensure we have a usable cloud client from stored variables (token reused if present)
//  * SIMPLIFIÉ - utilisé seulement pour les notifications MSmartHome
//  */
// async function ensureCloudClient() {
//     if (this.cloudClient) return this.cloudClient;
//     let uid;
//     let pwd;
//     try { uid = await this.gladys.variable.getValue('MIDEA_USER', this.serviceId); } catch (e) { }
//     try { pwd = await this.gladys.variable.getValue('MIDEA_PASSWORD', this.serviceId); } catch (e) { }
//     if (!uid || !pwd) return null;

//     const cc = new CloudConnection({ uid, password: pwd });
//     try {
//         const mask = (v) => (v ? `${String(v).slice(0, 3)}***${String(v).slice(-3)}` : v);
//         logger.debug(`Midea ensureCloudClient: uid=${mask(uid)} (for notifications only)`);
//         this.cloudClient = cc;
//         return this.cloudClient;
//     } catch (e) {
//         logger.debug(`Midea ensureCloudClient: failed to init client - ${e.message}`);
//         return null;
//     }
// }

// /**
//  * Connect to Midea cloud using node-mideahvac
//  * SIMPLIFIÉ - utilisé seulement pour activer les notifications MSmartHome
//  */
// async function connectCloud({ user, password }) {
//     const mask = (v) => (v ? `${String(v).slice(0, 2)}***${String(v).slice(-2)}` : v);
//     logger.info(`Midea AC LAN: cloud connect for notifications only - ${mask(user)}`);
//     try {
//         // Persist variables (needed for notifications)
//         if (user) await this.gladys.variable.setValue('MIDEA_USER', user, this.serviceId);
//         if (password) await this.gladys.variable.setValue('MIDEA_PASSWORD', password, this.serviceId);

//         // Init cloud client for notifications
//         const cc = new CloudConnection({ uid: user, password });
//         try {
//             const ret = await cc._authenticate();
//             this.cloudClient = cc;

//             logger.info(`Midea AC LAN: cloud authentication successful (notifications enabled)`);
//             return { success: true, provider: 'MSmartHome', purpose: 'notifications' };
//         } catch (e) {
//             logger.warn(`Midea AC LAN: cloud authentication failed - ${e.message}`);
//             throw new Error('CLOUD_AUTH_FAILED');
//         }
//     } catch (e) {
//         logger.error(`Midea AC LAN: connectCloud error - ${e.message}`);
//         throw e;
//     }
// }

// /**
//  * Get cloud connection status
//  */
// async function cloudStatus() {
//     try {
//         const client = await this.ensureCloudClient();
//         if (!client) return { connected: false };
//         return {
//             connected: !!client._accessToken,
//             provider: 'MSmartHome'
//         };
//     } catch (e) {
//         return { connected: false, error: e.message };
//     }
// }

// /**
//  * Clear cloud cache and credentials
//  * SIMPLIFIÉ - supprime seulement les credentials de base
//  */
// async function clearCloudCache() {
//     this.cloudClient = null;
//     try {
//         await this.gladys.variable.setValue('MIDEA_USER', '', this.serviceId);
//         await this.gladys.variable.setValue('MIDEA_PASSWORD', '', this.serviceId);
//     } catch (e) {
//         logger.warn(`Midea clearCloudCache: ${e.message}`);
//     }
//     return { success: true };
// }

// module.exports = {
//     ensureCloudClient,
//     connectCloud,
//     cloudStatus,
//     clearCloudCache
// };
