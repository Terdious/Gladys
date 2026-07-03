const sinon = require('sinon');
const { expect } = require('chai');

const { getDeviceSnapshot, CLOUD_MODEL_CACHE_TTL_MS } = require('../../../../services/tuya/lib/tuya.deviceSnapshot');
const { recordRawValues, getRawValues } = require('../../../../services/tuya/lib/tuya.diagnostics');

const buildDoorbellDevice = () => ({
  name: 'Visiophone',
  selector: 'tuya-doorbell',
  external_id: 'tuya:doorbell-id',
  device_type: 'video-doorbell',
  params: [
    { name: 'PRODUCT_ID', value: 'i5e3a4qxcsthszin' },
    { name: 'PROTOCOL_VERSION', value: '3.3' },
    { name: 'IP_ADDRESS', value: '10.0.0.9' },
    { name: 'LOCAL_OVERRIDE', value: true },
  ],
  features: [
    {
      external_id: 'tuya:doorbell-id:doorbell_active',
      selector: 'tuya-doorbell-doorbell-active',
      name: 'Doorbell',
      category: 'button',
      type: 'click',
      last_value: 1,
      last_value_changed: '2026-07-03T10:00:00.000Z',
    },
    {
      external_id: 'tuya:doorbell-id:motion_switch',
      selector: 'tuya-doorbell-motion-switch',
      name: 'Motion detection',
      category: 'switch',
      type: 'binary',
      last_value: 0,
    },
  ],
});

const buildCloudDetails = () => ({
  specifications: {
    functions: [{ code: 'motion_switch', name: 'Motion Switch' }],
    status: [
      { code: 'doorbell_active', name: 'Doorbell Active' },
      { code: 'wireless_electricity', name: 'Battery' },
    ],
  },
  properties: {
    properties: [
      { code: 'doorbell_active', dp_id: 136, value: '' },
      { code: 'motion_switch', dp_id: 134, value: false },
      { code: 'wireless_electricity', dp_id: 145, value: 87 },
    ],
  },
  thing_model: {
    services: [
      {
        properties: [{ code: 'doorbell_active', abilityId: 136, name: '门铃-呼叫' }],
      },
    ],
  },
});

const buildSelf = (device, { withConnector = true } = {}) => {
  const self = {
    gladys: {
      stateManager: {
        get: (kind, selector) => (kind === 'device' && selector === device.selector ? device : null),
      },
    },
    degradedDevices: {},
    persistentConnections: {
      'doorbell-id': { status: 'connected', lastDataAt: 1234 },
    },
    loadDeviceDetails: sinon.stub().resolves(buildCloudDetails()),
  };
  if (withConnector) {
    self.connector = { request: sinon.stub() };
  }
  self.getDeviceSnapshot = getDeviceSnapshot;
  self.recordRawValues = recordRawValues;
  self.getRawValues = getRawValues;
  return self;
};

describe('Tuya device snapshot', () => {
  it('returns not_found for an unknown selector', async () => {
    const self = buildSelf(buildDoorbellDevice());
    expect(await self.getDeviceSnapshot('nope')).to.deep.equal({ error: 'not_found' });
  });

  it('categorizes features with raw input, cloud/local paths, ignored and unsupported buckets', async () => {
    const device = buildDoorbellDevice();
    const self = buildSelf(device);
    // Raw values seen on the wire: the ring DP (136), an ignored pic DP (154) and an unknown DP (199).
    self.recordRawValues('doorbell-id', 'local_push', { 136: 'ring-payload', 154: 'pic-ref', 199: 42 }, 'dps');
    self.recordRawValues('doorbell-id', 'cloud', { basic_nightvision: '0' }, 'codes');

    const snapshot = await self.getDeviceSnapshot('tuya-doorbell');

    expect(snapshot.device).to.include({
      name: 'Visiophone',
      device_type: 'video-doorbell',
      product_id: 'i5e3a4qxcsthszin',
      protocol_version: '3.3',
      persistent_status: 'connected',
      cloud_model_loaded: true,
    });

    const ring = snapshot.supported.find((entry) => entry.code === 'doorbell_active');
    expect(ring).to.include({ dps_id: 136, name: 'Doorbell', category: 'button', type: 'click', last_value: 1 });
    expect(ring.raw).to.include({ value: 'ring-payload', origin: 'local_push' });
    // Cloud path: label + shadow dp_id + every section declaring the code.
    expect(ring.cloud.name).to.equal('Doorbell Active');
    expect(ring.cloud.dp_id).to.equal(136);
    expect(ring.cloud.sources).to.deep.equal(['specifications.status', 'thing_model', 'shadow.properties']);

    // No wire value for motion_switch: falls back to the shadow value.
    const motion = snapshot.supported.find((entry) => entry.code === 'motion_switch');
    expect(motion.raw).to.include({ value: false, origin: 'shadow' });
    expect(motion.cloud.sources).to.deep.equal(['specifications.functions', 'shadow.properties']);

    // Ignored: doorbell_pic dp 154 (from ignoredDps) carries its raw value; basic_nightvision (code
    // seen on the wire) sits in the ignored codes list.
    const ignoredPicByDp = snapshot.ignored.find((entry) => String(entry.dps_id) === '154');
    expect(ignoredPicByDp.raw).to.include({ value: 'pic-ref', origin: 'local_push' });
    expect(snapshot.ignored.find((entry) => entry.code === 'basic_nightvision').raw).to.include({
      value: '0',
      origin: 'cloud',
    });

    // Unsupported: a cloud-model code never seen on the wire (battery, with its shadow value) and a
    // wire-only DP never mapped (199).
    const battery = snapshot.unsupported.find((entry) => entry.code === 'wireless_electricity');
    expect(battery.cloud.name).to.equal('Battery');
    expect(battery.cloud.dp_id).to.equal(145);
    expect(battery.raw).to.include({ value: 87, origin: 'shadow' });
    expect(snapshot.unsupported.find((entry) => String(entry.dps_id) === '199').raw).to.include({ value: 42 });
  });

  it('prefers the freshest raw value regardless of origin (live local push over stale cloud)', async () => {
    const clock = sinon.useFakeTimers();
    try {
      const device = buildDoorbellDevice();
      const self = buildSelf(device);
      self.recordRawValues('doorbell-id', 'cloud', { motion_switch: true }, 'codes');
      clock.tick(60000);
      self.recordRawValues('doorbell-id', 'local_push', { 134: false }, 'dps');

      let snapshot = await self.getDeviceSnapshot('tuya-doorbell');
      expect(snapshot.supported.find((entry) => entry.code === 'motion_switch').raw).to.include({
        value: false,
        origin: 'local_push',
      });

      clock.tick(60000);
      self.recordRawValues('doorbell-id', 'cloud', { motion_switch: true }, 'codes');
      snapshot = await self.getDeviceSnapshot('tuya-doorbell');
      expect(snapshot.supported.find((entry) => entry.code === 'motion_switch').raw).to.include({
        value: true,
        origin: 'cloud',
      });
    } finally {
      clock.restore();
    }
  });

  it('caches the cloud model and refetches after the TTL', async () => {
    const clock = sinon.useFakeTimers();
    try {
      const device = buildDoorbellDevice();
      const self = buildSelf(device);

      await self.getDeviceSnapshot('tuya-doorbell');
      await self.getDeviceSnapshot('tuya-doorbell');
      expect(self.loadDeviceDetails.callCount).to.equal(1);

      clock.tick(CLOUD_MODEL_CACHE_TTL_MS + 1);
      await self.getDeviceSnapshot('tuya-doorbell');
      expect(self.loadDeviceDetails.callCount).to.equal(2);
    } finally {
      clock.restore();
    }
  });

  it('works without a connector (no cloud model) and reports the degraded status', async () => {
    const device = buildDoorbellDevice();
    const self = buildSelf(device, { withConnector: false });
    self.persistentConnections = {};
    self.degradedDevices = {
      'doorbell-id': { status: 'degraded', until: Date.now() + 60000, failureTimestamps: [] },
    };

    const snapshot = await self.getDeviceSnapshot('tuya-doorbell');

    expect(self.loadDeviceDetails.called).to.equal(false);
    expect(snapshot.device.cloud_model_loaded).to.equal(false);
    expect(snapshot.device.persistent_status).to.equal(null);
    expect(snapshot.device.degraded).to.have.property('status', 'degraded');
    expect(snapshot.supported.find((entry) => entry.code === 'doorbell_active').cloud).to.equal(null);
    expect(snapshot.supported.find((entry) => entry.code === 'doorbell_active').raw).to.equal(null);
  });

  it('keeps the stale cached model when the cloud refresh fails', async () => {
    const clock = sinon.useFakeTimers();
    try {
      const device = buildDoorbellDevice();
      const self = buildSelf(device);

      await self.getDeviceSnapshot('tuya-doorbell');
      clock.tick(CLOUD_MODEL_CACHE_TTL_MS + 1);
      self.loadDeviceDetails = sinon.stub().rejects(new Error('cloud down'));

      const snapshot = await self.getDeviceSnapshot('tuya-doorbell');
      expect(snapshot.device.cloud_model_loaded).to.equal(true);
      expect(snapshot.supported.find((entry) => entry.code === 'doorbell_active').cloud.name).to.equal(
        'Doorbell Active',
      );
    } finally {
      clock.restore();
    }
  });
});
