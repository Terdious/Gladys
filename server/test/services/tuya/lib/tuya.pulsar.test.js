const crypto = require('crypto');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const { buildPulsarPassword, decryptPulsarData } = require('../../../../services/tuya/lib/tuya.pulsar');

// Isolated sandbox so this file never touches the global sinon state other test files rely on.
const sandbox = sinon.createSandbox();

const ACCESS_ID = 'testaccessid1234';
const ACCESS_KEY = '0123456789abcdefghijklmnopqrstuv';

const encryptPulsarData = (document) => {
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(ACCESS_KEY.substring(8, 24), 'utf8'), null);
  return Buffer.concat([cipher.update(Buffer.from(JSON.stringify(document), 'utf8')), cipher.final()]).toString(
    'base64',
  );
};

// The pv 2.0 format observed in real life: 12-byte nonce + ciphertext + 16-byte auth tag, and the
// message properties carry em='aes_gcm'.
const encryptPulsarDataGcm = (document) => {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-128-gcm', Buffer.from(ACCESS_KEY.substring(8, 24), 'utf8'), nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(document), 'utf8')), cipher.final()]);
  return Buffer.concat([nonce, encrypted, cipher.getAuthTag()]).toString('base64');
};

const buildEnvelope = (document, { protocol = 4, messageId = 'message-1', gcm = false } = {}) => {
  const data = gcm ? encryptPulsarDataGcm(document) : encryptPulsarData(document);
  const payload = Buffer.from(JSON.stringify({ protocol, data })).toString('base64');
  return JSON.stringify({ messageId, payload, properties: gcm ? { em: 'aes_gcm' } : {} });
};

const wsInstances = [];

class FakeWebSocket extends EventEmitter {
  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.send = sandbox.stub();
    this.ping = sandbox.stub();
    this.terminate = sandbox.stub();
    wsInstances.push(this);
  }
}

const pulsar = proxyquire('../../../../services/tuya/lib/tuya.pulsar', {
  ws: FakeWebSocket,
});

const buildSelf = ({ enabled = 'true', accessId = ACCESS_ID, accessKey = ACCESS_KEY, device } = {}) => {
  const variables = {
    TUYA_PULSAR_ENABLED: enabled,
    TUYA_ENDPOINT: 'centralEurope',
    TUYA_ACCESS_KEY: accessId,
    TUYA_SECRET_KEY: accessKey,
  };
  const self = {
    serviceId: 'service-id',
    gladys: {
      variable: { getValue: sandbox.stub().callsFake(async (name) => variables[name]) },
      stateManager: { get: sandbox.stub().returns(device || null) },
      event: { emit: sandbox.stub() },
    },
    recordDiagnostic: sandbox.stub(),
    recordRawValues: sandbox.stub(),
    processMediaCodes: sandbox.stub(),
  };
  self.startPulsar = pulsar.startPulsar;
  self.stopPulsar = pulsar.stopPulsar;
  self.handlePulsarEvent = pulsar.handlePulsarEvent;
  return self;
};

const lastWs = () => wsInstances[wsInstances.length - 1];

describe('Tuya Pulsar listener', () => {
  beforeEach(() => {
    wsInstances.length = 0;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('derives the websocket password like the official SDK and decrypts messages', () => {
    const password = buildPulsarPassword(ACCESS_ID, ACCESS_KEY);
    expect(password).to.have.lengthOf(16);
    expect(password).to.equal(buildPulsarPassword(ACCESS_ID, ACCESS_KEY));
    expect(password).to.not.equal(buildPulsarPassword('other', ACCESS_KEY));

    const document = { devId: 'dev-1', status: [{ code: 'switch_1', value: true }] };
    expect(decryptPulsarData(encryptPulsarData(document), ACCESS_KEY)).to.deep.equal(document);
    expect(decryptPulsarData(encryptPulsarDataGcm(document), ACCESS_KEY, 'aes_gcm')).to.deep.equal(document);
    expect(decryptPulsarData('not-encrypted', ACCESS_KEY)).to.equal(null);
    expect(decryptPulsarData('not-encrypted', ACCESS_KEY, 'aes_gcm')).to.equal(null);
  });

  it('stays off when disabled and reports a missing configuration', async () => {
    const disabled = buildSelf({ enabled: 'false' });
    await disabled.startPulsar();
    expect(disabled.pulsar.status).to.equal('disabled');
    expect(wsInstances).to.have.lengthOf(0);

    const unconfigured = buildSelf({ accessId: null });
    await unconfigured.startPulsar();
    expect(unconfigured.pulsar.status).to.equal('not_configured');
    expect(wsInstances).to.have.lengthOf(0);
  });

  it('connects to the regional endpoint with the derived credentials and pings the socket', async () => {
    const clock = sandbox.useFakeTimers();
    const self = buildSelf();
    await self.startPulsar();

    const ws = lastWs();
    expect(ws.url).to.equal(
      `wss://mqe.tuyaeu.com:8285/ws/v2/consumer/persistent/${ACCESS_ID}/out/event/${ACCESS_ID}-sub?ackTimeoutMillis=3000&subscriptionType=Failover`,
    );
    expect(ws.options.headers.username).to.equal(ACCESS_ID);
    expect(ws.options.headers.password).to.equal(buildPulsarPassword(ACCESS_ID, ACCESS_KEY));

    ws.emit('open');
    expect(self.pulsar.status).to.equal('connected');
    clock.tick(30001);
    sinon.assert.calledOnce(ws.ping);
  });

  it('acks every message and routes data reports to the event handler', async () => {
    const self = buildSelf();
    self.handlePulsarEvent = sandbox.stub();
    await self.startPulsar();
    const ws = lastWs();
    ws.emit('open');

    const document = { devId: 'dev-1', status: [{ code: 'switch_1', value: true }] };
    ws.emit('message', Buffer.from(buildEnvelope(document)));

    sinon.assert.calledWith(ws.send, JSON.stringify({ messageId: 'message-1' }));
    sinon.assert.calledWithMatch(self.handlePulsarEvent, document);

    // The pv 2.0 messages observed in real life: properties.em selects the GCM decryption.
    ws.emit('message', Buffer.from(buildEnvelope(document, { messageId: 'message-2', gcm: true })));
    sinon.assert.calledTwice(self.handlePulsarEvent);
    sinon.assert.calledWithMatch(self.handlePulsarEvent.secondCall, document);
  });

  it('reports unparseable frames, foreign protocols and undecryptable payloads', async () => {
    const self = buildSelf();
    self.handlePulsarEvent = sandbox.stub();
    await self.startPulsar();
    const ws = lastWs();
    ws.emit('open');

    ws.emit('message', Buffer.from('not-json'));
    ws.emit('message', Buffer.from(buildEnvelope({ devId: 'x' }, { protocol: 20, messageId: 'message-2' })));
    const badData = JSON.stringify({
      messageId: 'message-3',
      payload: Buffer.from(JSON.stringify({ protocol: 4, data: 'garbage' })).toString('base64'),
    });
    ws.emit('message', Buffer.from(badData));

    const events = self.recordDiagnostic.getCalls().map((call) => call.args[2]);
    expect(events).to.include('pulsar_bad_message');
    expect(events).to.include('pulsar_other_protocol');
    expect(events).to.include('pulsar_decrypt_failed');
    sinon.assert.notCalled(self.handlePulsarEvent);
  });

  it('reconnects after a close and stops cleanly', async () => {
    const clock = sandbox.useFakeTimers();
    const self = buildSelf();
    await self.startPulsar();
    const firstWs = lastWs();
    firstWs.emit('open');
    firstWs.emit('error', new Error('socket reset'));
    firstWs.emit('close');
    expect(self.pulsar.status).to.equal('reconnecting');

    clock.tick(3001);
    expect(wsInstances).to.have.lengthOf(2);

    self.stopPulsar();
    expect(self.pulsar.status).to.equal('stopped');
    sinon.assert.calledOnce(lastWs().terminate);
    // Late events from the dropped socket are ignored.
    firstWs.emit('close');
    expect(self.pulsar.status).to.equal('stopped');
  });

  it('tolerates ping/ack failures, incomplete envelopes and stray stops', async () => {
    const clock = sandbox.useFakeTimers();
    const self = buildSelf();
    self.handlePulsarEvent = sandbox.stub();
    await self.startPulsar();
    const ws = lastWs();
    ws.emit('open');

    // A failing keepalive or ack must never crash the listener.
    ws.ping = sandbox.stub().throws(new Error('ping boom'));
    clock.tick(30001);
    ws.send = sandbox.stub().throws(new Error('send boom'));
    ws.emit('message', Buffer.from(JSON.stringify({ messageId: 'm-x' })));
    // A payload that is not JSON once base64-decoded is reported.
    ws.emit('message', Buffer.from(JSON.stringify({ payload: Buffer.from('not-json').toString('base64') })));
    const events = self.recordDiagnostic.getCalls().map((call) => call.args[2]);
    expect(events).to.include('pulsar_bad_message');
    sinon.assert.notCalled(self.handlePulsarEvent);

    // Late error/close events after a stop are ignored, and stopping without a listener is a no-op.
    self.stopPulsar();
    ws.emit('error', new Error('late'));
    ws.emit('open');
    ws.emit('message', Buffer.from('{}'));
    expect(self.pulsar.status).to.equal('stopped');
    const fresh = { stopPulsar: pulsar.stopPulsar };
    fresh.stopPulsar();
    expect(fresh.pulsar.status).to.equal('stopped');

    // Stopping while a reconnect is pending clears the retry timer.
    const reconnecting = buildSelf();
    await reconnecting.startPulsar();
    lastWs().emit('close');
    expect(reconnecting.pulsar.status).to.equal('reconnecting');
    reconnecting.stopPulsar();
    expect(reconnecting.pulsar.status).to.equal('stopped');
  });

  it('gives up with an explicit status when the message service rejects the credentials (401)', async () => {
    const clock = sandbox.useFakeTimers();
    const self = buildSelf();
    await self.startPulsar();
    const ws = lastWs();

    ws.emit('error', new Error('Unexpected server response: 401'));
    ws.emit('close');

    expect(self.pulsar.status).to.equal('unauthorized');
    const events = self.recordDiagnostic.getCalls().map((call) => call.args[2]);
    expect(events).to.include('pulsar_unauthorized');
    // Retrying cannot fix a 401 (Message Service not enabled on the project): no reconnect.
    clock.tick(120000);
    expect(wsInstances).to.have.lengthOf(1);
  });

  it('unrefs the real reconnect timer so it cannot hold the process open', async () => {
    // No fake timers here on purpose: the real setTimeout handle carries unref().
    const self = buildSelf();
    await self.startPulsar();
    lastWs().emit('close');
    expect(self.pulsar.status).to.equal('reconnecting');
    self.stopPulsar();
  });

  it('reports an unexpected start failure', async () => {
    const self = buildSelf();
    self.gladys.variable.getValue = sandbox.stub().rejects(new Error('variable store down'));
    await self.startPulsar();
    expect(self.pulsar.status).to.equal('error');
  });

  describe('handlePulsarEvent', () => {
    const doorbell = {
      external_id: 'tuya:dev-1',
      selector: 'tuya-dev-1',
      features: [
        {
          external_id: 'tuya:dev-1:switch_1',
          selector: 'tuya-dev-1-switch-1',
          category: 'switch',
          type: 'binary',
          last_value: 0,
        },
      ],
    };

    it('feeds the raw memory, the media pipeline and the state pipeline', () => {
      const self = buildSelf({ device: doorbell });
      const values = { switch_1: true, movement_detect_pic: 'payload' };

      self.handlePulsarEvent({
        devId: 'dev-1',
        status: [
          { code: 'switch_1', value: true },
          { code: 'movement_detect_pic', value: 'payload' },
        ],
      });

      sinon.assert.calledWith(self.recordRawValues, 'dev-1', 'pulsar', values, 'codes');
      sinon.assert.calledWith(self.processMediaCodes, doorbell, values);
      const stateEvent = self.gladys.event.emit
        .getCalls()
        .find((call) => call.args[1] && call.args[1].device_feature_external_id === 'tuya:dev-1:switch_1');
      expect(stateEvent.args[1].state).to.equal(1);
    });

    it('skips events without device id, lifecycle events and unknown devices', () => {
      const self = buildSelf({ device: null });

      self.handlePulsarEvent({ status: [{ code: 'switch_1', value: true }] });
      self.handlePulsarEvent({ devId: 'dev-1', bizCode: 'offline' });
      self.handlePulsarEvent({ devId: 'dev-1' });
      self.handlePulsarEvent({ devId: 'dev-1', status: [{ code: 'switch_1', value: true }] });

      const events = self.recordDiagnostic.getCalls().map((call) => call.args[2]);
      expect(events).to.include('pulsar_event_skipped');
      expect(events).to.include('pulsar_biz_event');
      expect(events).to.include('pulsar_unknown_device');
      sinon.assert.notCalled(self.recordRawValues);
    });
  });
});
