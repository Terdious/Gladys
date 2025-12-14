const { featureToSetStatusPatch } = require('./midea-ac-lan.mapper');

async function setFeatureValue(device, deviceFeature, value) {
    const entry = this.clients.get(device.external_id);
    if (!entry) throw new Error('Device session not active');
    const patch = featureToSetStatusPatch(deviceFeature.type, value);
    if (!patch) return;
    await entry.ac.setStatus(patch);
}

module.exports = { setFeatureValue };


