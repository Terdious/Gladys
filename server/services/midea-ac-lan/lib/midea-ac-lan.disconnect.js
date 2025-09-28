const { STATUS } = require('./utils/midea-ac-lan.constants');

/** @this {*} */
async function disconnect() {
    for (const [, c] of this.clients) {
        if (c.interval) clearInterval(c.interval);
        try {
            c.ac?.disconnect?.();
        } catch (e) { }
    }
    this.clients.clear();
    this.status = STATUS.DISCONNECTED;
}

module.exports = { disconnect };


