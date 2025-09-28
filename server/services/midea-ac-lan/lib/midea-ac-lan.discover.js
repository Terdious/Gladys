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
    // Si pas de target, essayer un scan automatique sur les réseaux courants
    if ((!list || list.length === 0) && !target) {
        const commonNetworks = ['192.168.1.0/24', '192.168.0.0/24', '10.0.0.0/24', '10.5.0.0/24'];
        for (const network of commonNetworks) {
            try {
                const hosts = await scanHosts({ subnet: network, port: 6444 });
                if (hosts && hosts.length > 0) {
                    list = hosts.map((h) => ({ id: undefined, host: h.host, port: h.port }));
                    break;
                }
            } catch (eScan) { }
        }
    }

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
    // DISABLE CLOUD TOKEN FETCH - We use pure local authentication now
    logger.info('Midea AC LAN: Cloud token/key fetch DISABLED - using pure local authentication');

    console.log('list', list);
    console.log('tokenCache', this.tokenCache);
    (list || []).map((d) => (console.log('d', d)));
    return (list || []).map((d) => ({
        id: d.id,
        // name: `Midea ${d.type || 'AC'} ${d.id || d.host}`,
        host: d.host,
        port: d.port,
        protocol: 3,
        subtype: d.subtype,
        type: d.type,
        key: d.key,
        token: d.token,
        fw: d.fw,
        udpId: d.udpId,
        model: d.model,
        name: d.name,
        rawUdpResponse: d.rawUdpResponse
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
                console.log(`UDP response from ${info.address}: ${msg.toString('hex')}`);

                // Variable to store the REAL token from structure analysis
                let realTokenFromStructureAnalysis = null;

                // Decode UDP response to see real data structure
                try {
                    // Skip 0x8370 header (6 bytes: 8370 + length + flags)
                    const payload = msg.subarray(6);
                    console.log(`UDP payload length: ${payload.length} bytes`);

                    // Look for 5a5a pattern in the payload (might not be at the start)
                    const pattern = Buffer.from([0x5a, 0x5a]);
                    const patternIndex = payload.indexOf(pattern);

                    if (patternIndex >= 0) {
                        console.log(`UDP: Found 5a5a pattern at offset ${patternIndex}`);
                        const mideaData = payload.subarray(patternIndex);

                        // Parse Midea UDP structure starting from 5a5a
                        if (mideaData.length >= 20) {
                            console.log(`UDP Structure Analysis:`);
                            console.log(`  Magic: ${mideaData.subarray(0, 2).toString('hex')} (should be 5a5a)`);
                            console.log(`  Version: ${mideaData.subarray(2, 4).toString('hex')}`);
                            console.log(`  Length: ${mideaData.readUInt16LE(4)} bytes`);
                            console.log(`  Command: ${mideaData.subarray(6, 8).toString('hex')}`);
                            console.log(`  Device ID area: ${mideaData.subarray(20, 26).toString('hex')}`);

                            // Look for text data (device model, etc.)
                            let textData = '';
                            for (let i = 26; i < Math.min(mideaData.length, 80); i++) {
                                const byte = mideaData[i];
                                if (byte >= 32 && byte <= 126) {
                                    textData += String.fromCharCode(byte);
                                } else if (byte === 0) {
                                    textData += '|';
                                } else {
                                    textData += '.';
                                }
                            }
                            console.log(`  Text data: "${textData}"`);

                            // Show potential token area (last 32 bytes of the Midea data)
                            if (mideaData.length >= 32) {
                                const tokenArea = mideaData.subarray(-32);
                                const potentialToken = tokenArea.toString('hex');
                                console.log(`  Potential token (last 32 bytes): ${potentialToken}`);

                                // STORE this as the REAL token to use later
                                realTokenFromStructureAnalysis = potentialToken;
                            }
                        }
                    } else {
                        console.log(`UDP: Invalid Midea format (no 5a5a magic)`);
                    }
                } catch (e) {
                    console.log(`UDP decode error: ${e.message}`);
                }
                let newEnc = false;
                if (msg[0] === 0x83 && msg[1] === 0x70) {
                    msg = msg.subarray(8, msg.length - 16);
                    newEnc = true;
                }
                if (msg[0] !== 0x5A || msg.length < 104) {
                    console.log(`Invalid UDP response: magic=${msg[0].toString(16)} length=${msg.length}`);
                    return finish(undefined);
                }
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

                // DECODE EVERYTHING: token, model, name from UDP response
                let token = null;
                let model = 'Unknown';
                let name = 'Unknown';

                try {
                    // Use the EXACT token from structure analysis (the "Potential token")
                    if (realTokenFromStructureAnalysis) {
                        token = realTokenFromStructureAnalysis;
                        console.log(`UDP: Using REAL token from structure analysis: ${token}`);
                    } else {
                        // Fallback: Extract token using ChatGPT method (last 32 bytes of original message)
                        const originalMsg = msg.toString('hex');
                        if (originalMsg.length >= 64) {
                            token = originalMsg.slice(-64); // Last 32 bytes = 64 hex chars
                            console.log(`UDP: Fallback token extraction: ${token}`);
                        }
                    }

                    // Extract model and serial number from decrypted data
                    // Based on HA logs: sn: '0000C3311171H120F3B0441000032ZRD', model: '171H120F'
                    // The model is typically embedded in the serial number or device info area

                    // Method 1: Look for model pattern in the entire decrypted data
                    const dataHex = data.toString('hex');
                    console.log(`UDP: Searching for model in data (${data.length} bytes): ${dataHex.slice(0, 200)}...`);

                    // Method 2: Extract from specific offsets based on HA behavior
                    // HA shows model '171H120F' - let's search for this pattern
                    let foundModel = null;

                    // Search for alphanumeric model patterns (like 171H120F)
                    const modelRegex = /[0-9]{3}[A-Z][0-9]{3}[A-Z]/g;
                    const dataString = data.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
                    console.log(`UDP: ASCII data for model search: ${dataString}`);

                    const modelMatches = dataString.match(modelRegex);
                    if (modelMatches && modelMatches.length > 0) {
                        foundModel = modelMatches[0];
                        console.log(`UDP: Found model pattern: ${foundModel}`);
                    }

                    // Method 3: Look in the serial number area (around offset 80-120)
                    if (!foundModel && data.length > 100) {
                        const serialArea = data.subarray(80, 120);
                        const serialString = serialArea.toString('ascii').replace(/[^\x20-\x7E]/g, '');
                        console.log(`UDP: Serial area: ${serialString}`);

                        const serialMatches = serialString.match(modelRegex);
                        if (serialMatches && serialMatches.length > 0) {
                            foundModel = serialMatches[0];
                            console.log(`UDP: Found model in serial area: ${foundModel}`);
                        }
                    }

                    if (foundModel) {
                        model = foundModel;
                        console.log(`UDP: Extracted model: ${model}`);
                    } else {
                        console.log(`UDP: Could not extract model, using default`);
                    }

                    // Extract device name (usually same as model or in SSID area)
                    if (data[40] > 0 && data.length > 40 + data[40]) {
                        const ssidBytes = data.subarray(41, 41 + data[40]);
                        let ssidText = '';
                        for (let i = 0; i < ssidBytes.length; i++) {
                            if (ssidBytes[i] >= 32 && ssidBytes[i] <= 126) {
                                ssidText += String.fromCharCode(ssidBytes[i]);
                            }
                        }
                        if (ssidText.length > 0) {
                            name = ssidText.trim();
                            console.log(`UDP: Extracted name from SSID: ${name}`);
                        }
                    }

                    // If we found a model, use it as the device name too (more descriptive than SSID)
                    if (foundModel && name === 'midea_c3_0003') {
                        name = `Midea ${foundModel}`;
                        console.log(`UDP: Using model-based name: ${name}`);
                    }

                } catch (e) {
                    console.log(`UDP: Error extracting additional data: ${e.message}`);
                }

                // Store ALL decoded information
                const result = {
                    id,
                    host: info.address || target,
                    port,
                    fw,
                    udpId,
                    type: typeName,
                    subtype,
                    token,      // ✅ TOKEN DECODED
                    model,      // ✅ MODEL DECODED  
                    name,       // ✅ NAME DECODED
                    rawUdpResponse: msg.toString('hex')
                };
                console.log(`UDP: Stored complete device info - token=${!!token} model=${model} name=${name}`);

                finish(result);
            } catch (e) {
                finish(undefined);
            }
        });
        socket.bind({}, () => {
            try { socket.setBroadcast(true); } catch (e) { }
            console.log(`Sending UDP discovery to ${target}:6445`);
            socket.send(broadcast, 0, broadcast.length, 6445, target, (err) => {
                if (err) {
                    console.log(`UDP send error: ${err.message}`);
                    return finish(undefined);
                }
                console.log(`UDP packet sent to ${target}:6445`);
            });
        });
        setTimeout(() => finish(undefined), 1500);
    });
}

module.exports = { discover, runDiscover, udpDiscoverTarget };


