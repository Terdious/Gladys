const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const logger = require('../../../utils/logger');
const net = require('net');
const dgram = require('dgram');
const crypto = require('crypto');
const { scanHosts } = require('./midea-ac-lan.scanHosts');
const CloudConnection = require('node-mideahvac/lib/cloud.js');

async function shouldUseCli(ctx) {
    try {
        if (ctx && ctx.gladys && ctx.serviceId) {
            const v = await ctx.gladys.variable.getValue('MIDEA_DISCOVER_CLI', ctx.serviceId);
            if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
        }
    } catch (e) { }
    const env = process.env.MIDEA_DISCOVER || process.env.MIDEA_DISCOVER_CLI;
    if (env) return env === '1' || String(env).toLowerCase() === 'true';
    return false;
}

async function runDiscover({ user, password, target }) {
    const args = [];
    if (user) args.push(`--user=${user}`);
    if (password) args.push(`--password=${password}`);
    if (target) args.push(`--target=${target}`);

    let stdout;
    try {
        ({ stdout } = await execFileAsync('npx', ['midea-discover', ...args], { encoding: 'utf8' }));
    } catch (e) {
        logger.warn(`Midea AC LAN: discovery tool not available (npx midea-discover). Returning empty list. ${e.message}`);
        return [];
    }
    const devices = [];
    const blocks = stdout.split('Appliance ').slice(1);
    for (const b of blocks) {
        const o = {};
        const read = (label) => {
            const m = b.match(new RegExp(`- ${label}:\\s*(.+)`));
            return m ? m[1].trim() : undefined;
        };
        o.id = read('Id');
        o.host = read('Host');
        o.port = Number(read('Port') || 6444);
        o.type = read('Appliance Type');
        o.fw = read('Firmware Version');
        o.key = read('Authentication Key');
        o.token = read('Authentication Token');
        devices.push(o);
    }
    return devices;
}

/**
 * @param {*} params
 */
async function discover(params) {
    const ctx = this || {};
    const { user, password, target } = params || {};
    const useCli = await shouldUseCli(ctx);
    let list = [];
    if (useCli) {
        try {
            list = await runDiscover({ user, password, target });
        } catch (e) {
            list = [];
        }
    }

    // Fallbacks when CLI discovery yields nothing (WSL2 broadcast issues, etc.)
    if ((!list || list.length === 0) && target && target !== 'auto') {
        // If target looks like CIDR, try TCP scan
        if (/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(target)) {
            try {
                const hosts = await scanHosts({ subnet: target, port: 6444 });
                list = hosts.map((h) => ({ id: undefined, host: h.host, port: h.port }));
            } catch (eScan) { }
        } else if (/^\d+\.\d+\.\d+\.\d+$/.test(target)) {
            // Single IP: quick TCP probe
            const reachable = await new Promise((resolve) => {
                const socket = net.createConnection({ host: target, port: 6444, timeout: 800 }, () => {
                    socket.end();
                    resolve(true);
                });
                socket.on('error', () => resolve(false));
                socket.on('timeout', () => {
                    try { socket.destroy(); } catch (e) { }
                    resolve(false);
                });
            });
            if (reachable) list = [{ id: undefined, host: target, port: 6444 }];
        }
    }

    // UDP enrichment (unicast): try to get id/udpId/type/fw for each host without details
    const udpTargets = (list || []).filter((d) => d && d.host && (!d.id || !d.type));
    if (udpTargets.length > 0) {
        logger.info(`Midea AC LAN: UDP enrichment for ${udpTargets.length} host(s)`);
        await Promise.all(
            udpTargets.map(async (d) => {
                try {
                    const detail = await udpDiscoverTarget(d.host);
                    if (detail) Object.assign(d, detail);
                    logger.info(`Midea AC LAN: UDP detail for ${d.host} id=${detail && detail.id} fw=${detail && detail.fw} udpId=${detail && detail.udpId}`);
                } catch (e) { }
            })
        );
    }

    // Enrichment: for any entry missing id/key/token, try direct discovery on that host
    if (useCli && list && list.length > 0) {
        const enriched = await Promise.all(
            list.map(async (d) => {
                if (!d || !d.host) return d;
                if (d.id && d.key && d.token) return d;
                try {
                    const details = await runDiscover({ user: undefined, password: undefined, target: d.host });
                    if (Array.isArray(details) && details.length) {
                        const match = details.find((x) => x.host === d.host || (d.id && x.id === d.id)) || details[0];
                        if (match) {
                            return { ...d, ...match };
                        }
                    }
                } catch (e) { }
                return d;
            })
        );
        list = enriched;
    }

    // Cloud token/key fetch via node-mideahvac when credentials are stored
    let uid;
    let pwd;
    let token;
    try { uid = await ctx.gladys.variable.getValue('MIDEA_USER', ctx.serviceId); } catch (e) { }
    try { pwd = await ctx.gladys.variable.getValue('MIDEA_PASSWORD', ctx.serviceId); } catch (e) { }
    try { token = await ctx.gladys.variable.getValue('MIDEA_ACCESS_TOKEN', ctx.serviceId); } catch (e) { }
    if (uid && pwd) {
        try {
            // Ensure an authenticated/usable client without re-login if we already have a token
            if (!ctx.cloudClient) {
                logger.info('Midea AC LAN: preparing cloud client for token/key fetch');
                ctx.cloudClient = new CloudConnection({ uid, password: pwd });
                if (token) ctx.cloudClient._accessToken = token;
                // quick validate by calling authenticate only if no token
                if (!token) {
                    try {
                        logger.info('Midea AC LAN: authenticating cloud client (no cached token)');
                        await ctx.cloudClient._authenticate();
                        // persist token for reuse
                        try { await ctx.gladys.variable.setValue('MIDEA_ACCESS_TOKEN', ctx.cloudClient._accessToken || '', ctx.serviceId); } catch (eTok) { }
                    } catch (eAuth) {
                        logger.warn(`Midea AC LAN: cloud auth error: ${eAuth && eAuth.message}`);
                    }
                }
            } else {
                // If we have cloudClient, try to reuse its current token
                if (!ctx.cloudClient._accessToken && token) ctx.cloudClient._accessToken = token;
            }
            logger.info('Midea AC LAN: Cloud token/key fetch enabled (reusing connection/token)');
            logger.debug(`Midea discover: cloud token.len=${String((ctx.cloudClient && ctx.cloudClient._accessToken) || '').length}`);
            await Promise.all(
                (list || []).map(async (d) => {
                    if (!d) return;
                    const cacheKey = d.udpId || d.id;
                    if (cacheKey && ctx.tokenCache && ctx.tokenCache.has(cacheKey)) {
                        const cached = ctx.tokenCache.get(cacheKey);
                        d.key = d.key || cached.key;
                        d.token = d.token || cached.token;
                        logger.info(`Midea AC LAN: cache hit for ${d.host} (${cacheKey})`);
                        return;
                    }
                    if (!d.udpId || d.token) return;
                    try {
                        const deviceIdHex = (d.id || '').toString(16);
                        logger.info(`Midea AC LAN: getToken for host=${d.host} id=${d.id} udpId=${d.udpId}`);
                        logger.debug(`Midea discover: attempt1 with idHex=${deviceIdHex}`);
                        // Important: some clouds bind token retrieval to the last loginId issued for the provided deviceId
                        try { await ctx.cloudClient._authenticate(deviceIdHex); } catch (eLogin) { }
                        const pair = await ctx.cloudClient.getToken(deviceIdHex, d.udpId);
                        logger.debug(`Midea discover: token attempt1 ok=${!!(pair && pair.key && pair.token)}`);
                        if (!pair || !pair.key || !pair.token) {
                            // retry variants: UDPID uppercase then decimal id
                            const up = String(d.udpId || '').toUpperCase();
                            logger.debug('Midea discover: attempt2 with UDPID upper');
                            const p2 = await ctx.cloudClient.getToken(deviceIdHex, up);
                            logger.debug(`Midea discover: token attempt2 (upper) ok=${!!(p2 && p2.key && p2.token)}`);
                            if (p2 && p2.key && p2.token) {
                                d.key = p2.key; d.token = p2.token;
                            }
                        } else {
                            d.key = pair.key; d.token = pair.token;
                        }
                        if (!d.key || !d.token) {
                            logger.debug('Midea discover: attempt3 with decimal id');
                            const p3 = await ctx.cloudClient.getToken(String(d.id || ''), d.udpId);
                            logger.debug(`Midea discover: token attempt3 (decimal) ok=${!!(p3 && p3.key && p3.token)}`);
                            if (p3 && p3.key && p3.token) { d.key = p3.key; d.token = p3.token; }
                        }
                        if (!d.key || !d.token) {
                            // last resort: raw call via axios wrapper, with on-demand authenticate if token looks invalid
                            try {
                                let accessToken = ctx.cloudClient && ctx.cloudClient._accessToken;
                                const { MideaCloudClient } = require('./cloud/midea-ac-lan.cloud');
                                const helper = new MideaCloudClient({ provider: 'MSmartHome' });
                                try { accessToken = await helper.authenticate(uid, pwd); } catch (eAuth2) { }
                                logger.debug(`Midea discover: raw call accessToken.len=${String(accessToken || '').length}`);
                                const raw = await helper.rawGetToken({ accessToken, udpId: d.udpId });
                                logger.debug(`Midea discover: raw tokenlist size=${(raw && raw.data && raw.data.tokenlist && raw.data.tokenlist.length) || 0}`);
                                const listTok = (raw && raw.data && raw.data.tokenlist) || [];
                                const found = listTok.find((p) => String(p.udpId || '').toLowerCase() === String(d.udpId || '').toLowerCase()) || listTok[0];
                                if (found) { d.key = found.key; d.token = found.token; }
                            } catch (eLow) { }
                        }
                        if (d.key && d.token) {
                            if (cacheKey && ctx.tokenCache) ctx.tokenCache.set(cacheKey, { key: d.key, token: d.token });
                            logger.info(`Midea AC LAN: token/key obtained for ${d.host}`);
                        } else {
                            logger.warn(`Midea AC LAN: getToken returned empty for ${d.host}`);
                        }
                    } catch (eTok) {
                        logger.warn(`Midea AC LAN: getToken failed for ${d.host}: ${eTok && eTok.message}`);
                    }
                })
            );
        } catch (eCloud) {
            logger.warn(`Midea AC LAN: cloud token/key loop error: ${eCloud && eCloud.message}`);
        }
    } else {
        logger.info('Midea AC LAN: cloud not configured; skip token/key fetch');
    }
    console.log('list', list);
    console.log('tokenCache', this.tokenCache);
    (list || []).map((d) => (console.log('d', d)));
    return (list || []).map((d) => ({
        id: d.id,
        name: `Midea ${d.type || 'AC'} ${d.id || d.host}`,
        host: d.host,
        port: d.port,
        protocol: 3,
        subtype: d.subtype,
        type: d.type,
        key: d.key,
        token: d.token,
        fw: d.fw,
        udpId: d.udpId
    }));
}

// --- Helpers ---
function decryptMideaPayload(dataHex) {
    const signKey = 'xhdiwjnchekd4d512chdjx5d8e4c394D2D7S';
    const key = crypto.createHash('md5').update(signKey).digest();
    const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');
    decipher.setAutoPadding(false);
    const out = Buffer['from'](decipher.update(dataHex, 'hex', 'hex') + decipher.final('hex'), 'hex');
    return out;
}

async function udpDiscoverTarget(target) {
    const socket = dgram.createSocket('udp4');
    const broadcast = Buffer['from']([
        0x5a, 0x5a, 0x01, 0x11, 0x48, 0x00, 0x92, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x7f, 0x75, 0xbd, 0x6b, 0x3e, 0x4f, 0x8b, 0x76,
        0x2e, 0x84, 0x9c, 0x6e, 0x57, 0x8d, 0x65, 0x90,
        0x03, 0x6e, 0x9d, 0x43, 0x42, 0xa5, 0x0f, 0x1f,
        0x56, 0x9e, 0xb8, 0xec, 0x91, 0x8e, 0x92, 0xe5
    ]);

    return new Promise((resolve) => {
        let resolved = false;
        const finish = (d) => {
            if (resolved) return;
            resolved = true;
            try { socket.close(); } catch (e) { }
            resolve(d);
        };
        socket.once('message', (msg, info) => {
            try {
                let newEnc = false;
                if (msg[0] === 0x83 && msg[1] === 0x70) {
                    msg = msg.subarray(8, msg.length - 16);
                    newEnc = true;
                }
                if (msg[0] !== 0x5A || msg.length < 104) return finish(undefined);
                const id = parseInt(msg.subarray(20, 26).toString('hex').match(/../g).reverse().join(''), 16);
                const data = decryptMideaPayload(msg.subarray(40, msg.length - 16).toString('hex'));
                const port = parseInt(data.subarray(4, 8).toString('hex').match(/../g).reverse().join(''), 16);
                const fw = `${data[72 + data[40]]}.${data[73 + data[40]]}.${data[74 + data[40]]}`;
                const ssidLen = data[40];
                const typeCode = data[55 + ssidLen];
                const subtype = parseInt(data.subarray(57 + ssidLen, 59 + ssidLen).toString('hex').match(/../g).reverse().join(''), 16);
                let udpId;
                if (newEnc) {
                    const digest = Buffer["from"](crypto.createHash('sha256').update(Buffer["from"](msg.subarray(20, 26).toString('hex'), 'hex')).digest('hex'), 'hex');
                    const buf = Buffer["alloc"](16);
                    for (let i = 0; i < 16; i++) buf[i] = digest[i] ^ digest[i + 16];
                    udpId = buf.toString('hex');
                }
                const applianceTypes = { 0xA1: 'Dehumidifier', 0xAC: 'Air Conditioner', 0xC3: 'Heat Pump Wi-Fi Controller', 0xFA: 'Fan', 0xFC: 'Air Purifier', 0xFD: 'Humidifier' };
                const typeName = applianceTypes[typeCode] || 'Unknown';
                finish({ id, host: info.address || target, port, fw, udpId, type: typeName, subtype });
            } catch (e) {
                finish(undefined);
            }
        });
        socket.bind({}, () => {
            try { socket.setBroadcast(true); } catch (e) { }
            socket.send(broadcast, 0, broadcast.length, 6445, target, (err) => {
                if (err) return finish(undefined);
            });
        });
        setTimeout(() => finish(undefined), 1500);
    });
}

module.exports = { discover, runDiscover };


