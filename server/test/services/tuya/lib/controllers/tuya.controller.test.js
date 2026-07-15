const sinon = require('sinon');
const { expect } = require('chai');
const TuyaController = require('../../../../../services/tuya/api/tuya.controller');

const { assert, fake } = sinon;

const tuyaManager = {
  discoverDevices: fake.resolves([]),
  localPoll: fake.resolves({ dps: { 1: true } }),
  localScan: fake.resolves({ devices: { device1: { ip: '1.1.1.1', version: '3.3' } }, portErrors: {} }),
  getStatus: fake.resolves({ status: 'connected' }),
  manualDisconnect: fake.resolves(),
  saveConfiguration: fake.resolves({ baseUrl: 'apiUrl', accessKey: 'a', secretKey: 's', appAccountId: 'u' }),
  discoveredDevices: [
    {
      external_id: 'tuya:device1',
      params: [],
    },
  ],
  degradedDevices: {},
  getDiagnostics: fake.returns({ entries: [{ id: 1, level: 'info' }], lastId: 1 }),
};
const defaultLocalScan = tuyaManager.localScan;

describe('TuyaController GET /api/v1/service/tuya/discover', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
    tuyaManager.localScan = fake.resolves({ devices: { device1: { ip: '1.1.1.1', version: '3.3' } }, portErrors: {} });
    tuyaManager.discoveredDevices = [{ external_id: 'tuya:device1', params: [] }];
  });

  it('should return discovered devices', async () => {
    const req = {};
    const res = {
      json: fake.returns([]),
    };

    await controller['get /api/v1/service/tuya/discover'].controller(req, res);
    assert.calledOnce(tuyaManager.discoverDevices);
    assert.calledOnce(res.json);
  });
});

describe('TuyaController POST /api/v1/service/tuya/local-poll', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
    tuyaManager.localScan = fake.resolves({ devices: { device1: { ip: '1.1.1.1', version: '3.3' } }, portErrors: {} });
    tuyaManager.discoveredDevices = [{ external_id: 'tuya:device1', params: [] }];
  });

  it('should return local poll result', async () => {
    const req = {
      body: { deviceId: 'device1', ip: '1.1.1.1', localKey: 'key', protocolVersion: '3.3' },
    };
    const res = {
      json: fake.returns([]),
    };

    await controller['post /api/v1/service/tuya/local-poll'].controller(req, res);
    assert.calledOnce(tuyaManager.localPoll);
    assert.calledOnce(res.json);
  });

  it('should return local poll result without updating device', async () => {
    const req = {
      body: { deviceId: 'unknown', ip: '1.1.1.1', localKey: 'key', protocolVersion: '3.3' },
    };
    const res = {
      json: fake.returns([]),
    };
    tuyaManager.discoveredDevices = [{ external_id: 'tuya:device1', params: [] }];

    await controller['post /api/v1/service/tuya/local-poll'].controller(req, res);
    assert.calledOnce(tuyaManager.localPoll);
    assert.calledWith(res.json, { dps: { 1: true } });
  });

  it('should update existing params when device is found', async () => {
    const req = {
      body: { deviceId: 'device1', ip: '2.2.2.2', protocolVersion: '3.3' },
    };
    const res = {
      json: fake.returns([]),
    };
    tuyaManager.discoveredDevices = [
      {
        external_id: 'tuya:device1',
        product_id: 'pid',
        product_key: 'pkey',
        params: [{ name: 'IP_ADDRESS', value: '1.1.1.1' }],
      },
    ];

    await controller['post /api/v1/service/tuya/local-poll'].controller(req, res);

    const updated = tuyaManager.discoveredDevices[0];
    const ipParam = updated.params.find((param) => param.name === 'IP_ADDRESS');
    const localKeyParam = updated.params.find((param) => param.name === 'LOCAL_KEY');

    expect(ipParam.value).to.equal('2.2.2.2');
    expect(localKeyParam).to.equal(undefined);
    assert.calledOnce(res.json);
  });

  it('should default to empty body when req.body is missing on local-poll', async () => {
    const req = {};
    const res = { json: fake.returns([]) };
    await controller['post /api/v1/service/tuya/local-poll'].controller(req, res);
    assert.calledOnce(tuyaManager.localPoll);
  });

  it('should pass the known local dps to localPoll when the device type is resolved', async () => {
    const req = {
      body: { deviceId: 'device1', ip: '1.1.1.1', localKey: 'key', protocolVersion: '3.3' },
    };
    const res = { json: fake.returns([]) };
    tuyaManager.discoveredDevices = [{ external_id: 'tuya:device1', device_type: 'video-doorbell', params: [] }];

    await controller['post /api/v1/service/tuya/local-poll'].controller(req, res);

    const payload = tuyaManager.localPoll.firstCall.args[0];
    expect(payload.requestedDps).to.deep.equal([
      101,
      103,
      104,
      106,
      108,
      109,
      110,
      111,
      115,
      117,
      134,
      136,
      150,
      151,
      154,
      160,
    ]);
  });

  it('should resolve the known local dps from the state manager when the device is not discovered', async () => {
    const req = {
      body: { deviceId: 'device2', ip: '1.1.1.1', localKey: 'key', protocolVersion: '3.3' },
    };
    const res = { json: fake.returns([]) };
    tuyaManager.gladys = {
      stateManager: { get: fake.returns({ device_type: 'smart-meter' }) },
    };
    try {
      await controller['post /api/v1/service/tuya/local-poll'].controller(req, res);
    } finally {
      delete tuyaManager.gladys;
    }

    const payload = tuyaManager.localPoll.firstCall.args[0];
    expect(payload.requestedDps)
      .to.be.an('array')
      .that.includes(115);
  });
});

describe('TuyaController POST /api/v1/service/tuya/local-scan', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
    tuyaManager.localScan = fake.resolves({ devices: { device1: { ip: '1.1.1.1', version: '3.3' } }, portErrors: {} });
    tuyaManager.discoveredDevices = [{ external_id: 'tuya:device1', params: [] }];
  });

  afterEach(() => {
    tuyaManager.localScan = defaultLocalScan;
  });

  it('should run local scan and return devices', async () => {
    const req = { body: { timeoutSeconds: 1 } };
    const res = {
      json: fake.returns([]),
    };

    await controller['post /api/v1/service/tuya/local-scan'].controller(req, res);
    assert.calledOnce(tuyaManager.localScan);
    assert.calledOnce(res.json);
  });

  it('should return local devices even without discovered devices', async () => {
    const req = { body: { timeoutSeconds: 1 } };
    const res = {
      json: fake.returns([]),
    };
    tuyaManager.discoveredDevices = null;

    await controller['post /api/v1/service/tuya/local-scan'].controller(req, res);
    assert.calledOnce(tuyaManager.localScan);
    assert.calledOnce(res.json);
    const payload = res.json.firstCall.args[0];
    expect(payload.devices).to.have.length(1);
    expect(payload.devices[0].external_id).to.equal('tuya:device1');
    expect(payload.local_devices).to.deep.equal({ device1: { ip: '1.1.1.1', version: '3.3' } });
    expect(payload.port_errors).to.deep.equal({});
  });

  it('should keep devices unchanged when local info is missing', async () => {
    const req = { body: { timeoutSeconds: 1 } };
    const res = {
      json: fake.returns([]),
    };
    tuyaManager.localScan = fake.resolves({ devices: {}, portErrors: {} });
    tuyaManager.discoveredDevices = [{ external_id: 'tuya:device1', params: [] }];

    await controller['post /api/v1/service/tuya/local-scan'].controller(req, res);
    assert.calledOnce(tuyaManager.localScan);
    assert.calledWith(res.json, {
      devices: [{ external_id: 'tuya:device1', params: [] }],
      local_devices: {},
      port_errors: {},
    });
  });

  it('should default to empty body when req.body is missing', async () => {
    const req = {};
    const res = { json: fake.returns([]) };
    await controller['post /api/v1/service/tuya/local-scan'].controller(req, res);
    assert.calledOnce(tuyaManager.localScan);
  });
});

describe('TuyaController GET /api/v1/service/tuya/status', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
  });

  it('should return status', async () => {
    const req = {};
    const res = { json: fake.returns([]) };

    await controller['get /api/v1/service/tuya/status'].controller(req, res);
    assert.calledOnce(tuyaManager.getStatus);
    assert.calledWith(res.json, { status: 'connected' });
  });
});

describe('TuyaController POST /api/v1/service/tuya/configuration', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
  });

  it('should save configuration', async () => {
    const req = { body: { baseUrl: 'apiUrl', accessKey: 'a', secretKey: 's', appAccountId: 'u' } };
    const res = { json: fake.returns([]) };

    await controller['post /api/v1/service/tuya/configuration'].controller(req, res);
    assert.calledOnce(tuyaManager.saveConfiguration);
    assert.calledOnce(res.json);
  });
});

describe('TuyaController POST /api/v1/service/tuya/disconnect', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
  });

  it('should disconnect', async () => {
    const req = {};
    const res = { json: fake.returns([]) };

    await controller['post /api/v1/service/tuya/disconnect'].controller(req, res);
    assert.calledOnce(tuyaManager.manualDisconnect);
    assert.calledWith(res.json, { success: true });
  });
});

describe('TuyaController GET /api/v1/service/tuya/local-status', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
  });

  it('should return all degraded devices when no deviceId is given', async () => {
    tuyaManager.degradedDevices = {
      d1: { status: 'degraded', until: Date.now() + 60000, failureTimestamps: [] },
      d2: { status: 'ok', until: 0, failureTimestamps: [] },
    };
    const res = { json: fake.returns(null) };
    await controller['get /api/v1/service/tuya/local-status'].controller({ query: {} }, res);
    const payload = res.json.firstCall.args[0];
    expect(payload).to.have.property('devices');
    expect(payload.devices).to.have.property('d1');
    expect(payload.devices).to.not.have.property('d2');
  });

  it('should return only the requested device status', async () => {
    tuyaManager.degradedDevices = {
      d1: { status: 'degraded', until: Date.now() + 60000, failureTimestamps: [] },
    };
    const res = { json: fake.returns(null) };
    await controller['get /api/v1/service/tuya/local-status'].controller({ query: { deviceId: 'd1' } }, res);
    const payload = res.json.firstCall.args[0];
    expect(payload.deviceId).to.equal('d1');
    expect(payload.status).to.have.property('status', 'degraded');
  });

  it('should return null status for an unknown deviceId', async () => {
    tuyaManager.degradedDevices = {};
    const res = { json: fake.returns(null) };
    await controller['get /api/v1/service/tuya/local-status'].controller({ query: { deviceId: 'd1' } }, res);
    expect(res.json.firstCall.args[0]).to.deep.equal({ deviceId: 'd1', status: null });
  });

  it('should fall back to empty query object when req.query is missing', async () => {
    tuyaManager.degradedDevices = {};
    const res = { json: fake.returns(null) };
    await controller['get /api/v1/service/tuya/local-status'].controller({}, res);
    expect(res.json.firstCall.args[0]).to.deep.equal({ devices: {} });
  });
});

describe('TuyaController POST /api/v1/service/tuya/local-poll resets degraded backoff', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
  });

  it('should clear the degraded entry for the requested device before polling', async () => {
    tuyaManager.degradedDevices = {
      device1: { status: 'degraded', until: Date.now() + 60000, failureTimestamps: [] },
    };
    const req = { body: { deviceId: 'device1', ip: '1.1.1.1', localKey: 'key', protocolVersion: '3.3' } };
    const res = { json: fake.returns(null) };

    await controller['post /api/v1/service/tuya/local-poll'].controller(req, res);

    expect(tuyaManager.degradedDevices.device1).to.equal(undefined);
  });
});

describe('TuyaController GET /api/v1/service/tuya/diagnostics', () => {
  let controller;

  beforeEach(() => {
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
  });

  it('should forward the query filters to getDiagnostics and return its result', async () => {
    const res = { json: fake.returns(null) };
    await controller['get /api/v1/service/tuya/diagnostics'].controller(
      { query: { deviceId: 'device1', level: 'warn', sinceId: '42' } },
      res,
    );

    assert.calledWith(tuyaManager.getDiagnostics, { deviceId: 'device1', level: 'warn', sinceId: '42' });
    expect(res.json.firstCall.args[0]).to.deep.equal({ entries: [{ id: 1, level: 'info' }], lastId: 1 });
  });

  it('should fall back to an empty query object when req.query is missing', async () => {
    const res = { json: fake.returns(null) };
    await controller['get /api/v1/service/tuya/diagnostics'].controller({}, res);

    assert.calledWith(tuyaManager.getDiagnostics, { deviceId: undefined, level: undefined, sinceId: undefined });
  });
});

describe('TuyaController GET /api/v1/service/tuya/device-snapshot', () => {
  let controller;

  beforeEach(() => {
    tuyaManager.getDeviceSnapshot = fake.resolves({ device: { selector: 'tuya-device' }, supported: [] });
    controller = TuyaController(tuyaManager);
    sinon.resetHistory();
  });

  it('should forward the selector and return the snapshot', async () => {
    const res = { json: fake.returns(null) };
    await controller['get /api/v1/service/tuya/device-snapshot'].controller(
      { query: { selector: 'tuya-device' } },
      res,
    );

    assert.calledWith(tuyaManager.getDeviceSnapshot, 'tuya-device');
    expect(res.json.firstCall.args[0]).to.deep.equal({ device: { selector: 'tuya-device' }, supported: [] });
  });

  it('should fall back to an empty query object when req.query is missing', async () => {
    const res = { json: fake.returns(null) };
    await controller['get /api/v1/service/tuya/device-snapshot'].controller({}, res);
    assert.calledWith(tuyaManager.getDeviceSnapshot, undefined);
  });
});
