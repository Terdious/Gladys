const logger = require('../../../utils/logger');

/**
 * Confirm device and retrieve Token/Key via pure local authentication
 */
async function confirmDevice({ id, udpId, host, rawUdpResponse }) {
    let uid;
    let pwd;
    try { uid = await this.gladys.variable.getValue('MIDEA_USER', this.serviceId); } catch (e) { }
    try { pwd = await this.gladys.variable.getValue('MIDEA_PASSWORD', this.serviceId); } catch (e) { }
    if (!uid || !pwd) {
        throw new Error('CLOUD_NOT_CONFIGURED');
    }
    logger.debug(`Midea confirmDevice: received id=${id} udpId=${udpId} host=${host} rawUdpResponse=${rawUdpResponse ? 'YES' : 'NO'}`);

    if (!udpId && !id && !host) {
        throw new Error('DEVICE_ID_OR_HOST_REQUIRED');
    }

    // If we have host but no ID, try to discover it first
    if (!id && host) {
        logger.info(`Midea AC LAN: No device ID provided, attempting UDP discovery on ${host}`);
        try {
            const { udpDiscoverTarget } = require('./midea-ac-lan.discover');
            const discovered = await udpDiscoverTarget(host);
            if (discovered && discovered.id) {
                id = discovered.id;
                udpId = discovered.udpId;
                logger.info(`Midea AC LAN: Discovered device ID ${id} via UDP`);
            }
        } catch (eDisc) {
            logger.warn(`Midea AC LAN: UDP discovery failed: ${eDisc.message}`);
        }
    }

    try {
        logger.info(`Midea AC LAN: confirmDevice -> LOCAL negotiation ONLY id=${id} udpId=${udpId} host=${host}`);
        let key;
        let token;

        // PURE LOCAL AUTHENTICATION - like wuwentao/midea_ac_lan (NO CLOUD!)
        // HA does NOT use cloud authentication - it does pure local handshake
        logger.info(`Midea AC LAN: Pure LOCAL authentication like wuwentao/midea_ac_lan (NO CLOUD)`);

        try {
            // Pure local authentication - no cloud token needed!
            // This is exactly how HA works with wuwentao/midea_ac_lan
            // Use the UDP response we already have from discovery (no need to re-fetch!)
            let udpResponse = null;

            // Look for existing UDP response in the discovery data we already have
            // The udpId parameter comes from the discovery, so we should have the raw response
            logger.debug(`MideaLocalAuth: Looking for existing UDP response for udpId=${udpId}`);

            // Use the rawUdpResponse from the FIRST discovery (passed from front-end)
            if (rawUdpResponse) {
                udpResponse = rawUdpResponse;
                logger.info(`MideaLocalAuth: Using rawUdpResponse from FIRST discovery (front-end): ${udpResponse.slice(-64)}`);
            } else {
                // Fallback: Get FRESH UDP response if not provided
                try {
                    logger.debug(`MideaLocalAuth: No rawUdpResponse provided, performing fresh UDP discovery`);
                    const { udpDiscoverTarget } = require('./midea-ac-lan.discover');

                    const udpResult = await udpDiscoverTarget(host);

                    if (udpResult && udpResult.rawUdpResponse) {
                        udpResponse = udpResult.rawUdpResponse;
                        logger.info(`MideaLocalAuth: Got FRESH UDP response with dynamic token: ${udpResponse.slice(-64)}`);
                    } else {
                        logger.warn(`MideaLocalAuth: No rawUdpResponse in fresh UDP result`);
                    }
                } catch (eUdp) {
                    logger.warn(`MideaLocalAuth: Could not get fresh UDP response: ${eUdp.message}`);
                }
            }

            // EXTRACT Token AND Key directly from UDP response (like Home Assistant!)
            // No need for TCP handshake - HA gets everything from UDP!
            try {
                function extractTokenFromRawUdp(rawHex) {
                    const hex = String(rawHex || '').toLowerCase().replace(/[^0-9a-f]/g, '');
                    if (hex.length < 64) return null;

                    // Token = DERNIERS 32 octets (64 hex chars)
                    const token = hex.slice(-64);
                    return /^[0-9a-f]{64}$/.test(token) ? token : null;
                }

                const extractedToken = extractTokenFromRawUdp(udpResponse);
                if (extractedToken) {
                    // In Midea protocol, token and key are often the same or derived from the same source
                    token = extractedToken;
                    key = extractedToken; // Same as token for local authentication

                    logger.info(`Midea AC LAN: SUCCESS! Extracted Token/Key from UDP like HA`);
                    logger.debug(`Midea AC LAN: token=${token.substring(0, 8)}... key=${key.substring(0, 8)}...`);
                } else {
                    logger.warn(`Midea AC LAN: Could not extract token from UDP response`);
                }
            } catch (eExtract) {
                logger.warn(`Midea AC LAN: Token extraction error: ${eExtract.message}`);
            }

        } catch (eLoc) {
            logger.warn(`Midea AC LAN: Pure local authentication error: ${eLoc && (eLoc.stack || eLoc.message)}`);
        }
        // Return the complete device with updated key and token
        const result = {
            id,
            udpId,
            host,
            key,
            token,
            // Include other device info that might be needed
            confirmed: true
        };
        logger.debug(`Midea confirmDevice: result hasToken=${!!token} hasKey=${!!key}`);
        return result;
    } catch (e) {
        logger.warn(`Midea AC LAN: confirmDevice failed - ${e && (e.stack || e.message)}`);
        throw e;
    }
}

module.exports = {
    confirmDevice
};
