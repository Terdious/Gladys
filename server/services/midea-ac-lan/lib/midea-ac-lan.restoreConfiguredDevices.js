const { getDeviceParam } = require('../../../utils/device');

async function restoreConfiguredDevices() {
    const devices = await this.gladys.device.get({ service: 'midea-ac-lan' });
    for (const d of devices) {
        const id = getDeviceParam(d, 'MIDEA_ID');
        const key = getDeviceParam(d, 'MIDEA_KEY');
        const token = getDeviceParam(d, 'MIDEA_TOKEN');
        const host = getDeviceParam(d, 'MIDEA_HOST');
        const port = Number(getDeviceParam(d, 'MIDEA_PORT') || 6444);
        if (id && host) {
            await this._attach(d, { id, key, token, host, port });
        }
    }
}

module.exports = { restoreConfiguredDevices };


