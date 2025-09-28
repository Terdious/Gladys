async function listDevices() {
    return this.gladys.device.get({ service: 'midea-ac-lan' });
}

module.exports = { listDevices };


