const net = require('net');

function ipRangeFromCidr(cidr) {
    const [base, bitsStr] = cidr.split('/');
    const bits = Number(bitsStr || 24);
    const toInt = (ip) => ip.split('.').reduce((acc, v) => (acc << 8) + Number(v), 0) >>> 0;
    const toIp = (int) => [24, 16, 8, 0].map((b) => (int >>> b) & 255).join('.');
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    const baseInt = toInt(base) & mask;
    const size = 2 ** (32 - bits);
    const ips = [];
    const start = baseInt + 1; // skip network
    const end = baseInt + size - 2; // skip broadcast
    for (let i = start; i <= end; i++) ips.push(toIp(i >>> 0));
    return ips;
}

async function probeHost(host, port = 6444, timeout = 600) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host, port });
        let done = false;
        const finish = (ok) => {
            if (done) return;
            done = true;
            try { socket.destroy(); } catch (e) { }
            resolve(ok);
        };
        socket.setTimeout(timeout, () => finish(false));
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
    });
}

async function scanHosts({ subnet, port = 6444, limit = 64 }) {
    if (!subnet) throw new Error('SUBNET_REQUIRED');
    const ips = ipRangeFromCidr(subnet);
    const results = [];
    const queue = ips.slice(0, limit);
    let idx = limit;
    await Promise.all(
        queue.map(async (_, i) => {
            let ip = ips[i];
            while (ip) {
                const ok = await probeHost(ip, port);
                if (ok) results.push({ host: ip, port });
                ip = ips[idx++];
            }
        })
    );
    return results;
}

module.exports = { scanHosts };



