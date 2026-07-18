const os = require('os');
const fsSync = require('fs');
const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const mediaModule = require('../../../../services/tuya/lib/tuya.media');

const { decodeMediaPayload, mapDpsToMediaCodes } = mediaModule;

// Same shape as the real payload captured on a i5e3a4qxcsthszin doorbell (anonymized path and
// signature). The second file element is the AES key — EMPTY on the observed device.
const buildPayload = (overrides = {}) => {
  const document = {
    bucket: 'ty-eu-storage30-pic',
    files: [['/000000-000000000-pp00000000000000000000/detect/1783285843.jpeg?param=QUFBQUFBQUFBQUFBQQ==', '']],
    v: '3.0',
    ...overrides,
  };
  return Buffer.from(JSON.stringify(document)).toString('base64');
};

const buildSelf = (mediaLib, { withDiagnostics = true } = {}) => {
  const self = {
    gladys: {
      config: { tempFolder: os.tmpdir() },
      device: {
        camera: { setImage: sinon.stub().resolves() },
      },
    },
  };
  if (withDiagnostics) {
    self.recordDiagnostic = sinon.stub();
  }
  self.handleMediaValue = mediaLib.handleMediaValue;
  self.processMediaCodes = mediaLib.processMediaCodes;
  return self;
};

const device = { external_id: 'tuya:doorbell-id', selector: 'tuya-doorbell' };

describe('Tuya doorbell media', () => {
  describe('decodeMediaPayload', () => {
    it('decodes a real-shaped payload', () => {
      const media = decodeMediaPayload(buildPayload());
      expect(media.bucket).to.equal('ty-eu-storage30-pic');
      expect(media.filePath).to.include('/detect/1783285843.jpeg?param=');
      expect(media.encryptionKey).to.equal('');
      expect(media.version).to.equal('3.0');
    });

    it('returns null on non-media values', () => {
      expect(decodeMediaPayload('')).to.equal(null);
      expect(decodeMediaPayload(42)).to.equal(null);
      expect(decodeMediaPayload('not-base64-json')).to.equal(null);
      expect(decodeMediaPayload(Buffer.from('"just a string"').toString('base64'))).to.equal(null);
      expect(decodeMediaPayload(buildPayload({ bucket: undefined }))).to.equal(null);
      expect(decodeMediaPayload(buildPayload({ files: [] }))).to.equal(null);
      expect(decodeMediaPayload(buildPayload({ files: [['', '']] }))).to.equal(null);
    });

    it('defaults a non-string key to empty', () => {
      const media = decodeMediaPayload(buildPayload({ files: [['/path.jpeg?param=x', null]] }));
      expect(media.encryptionKey).to.equal('');
    });

    it('decodes a Pulsar direct-URL payload (base64 of a presigned https URL)', () => {
      const url =
        'https://ty-eu-storage30-pic.s3.eu-central-1.amazonaws.com/000000/detect/1784367887.jpeg?X-Amz-Signature=abc&X-Amz-Expires=60';
      const media = decodeMediaPayload(Buffer.from(url).toString('base64'));
      expect(media).to.deep.equal({ directUrl: url });
    });
  });

  describe('mapDpsToMediaCodes', () => {
    it('maps the doorbell media DPS to their codes (string or numeric keys)', () => {
      expect(mapDpsToMediaCodes({ '115': 'motion-raw', 1: true })).to.deep.equal({
        movement_detect_pic: 'motion-raw',
      });
      expect(mapDpsToMediaCodes({ 154: 'ring-raw' })).to.deep.equal({ doorbell_pic: 'ring-raw' });
      expect(mapDpsToMediaCodes(null)).to.deep.equal({});
    });
  });

  describe('handleMediaValue', () => {
    const load = (axiosStub, childProcessStub) =>
      proxyquire('../../../../services/tuya/lib/tuya.media', {
        axios: axiosStub,
        // eslint-disable-next-line camelcase
        child_process: childProcessStub || { execFile: sinon.stub().yields(new Error('ffmpeg not stubbed')) },
      });

    it('downloads the snapshot and stores it on the camera feature', async () => {
      const axiosStub = { get: sinon.stub().resolves({ data: Buffer.from('jpeg-bytes') }) };
      const media = load(axiosStub);
      const self = buildSelf(media);

      const stored = await self.handleMediaValue(device, 'movement_detect_pic', buildPayload());

      expect(stored).to.equal(true);
      expect(axiosStub.get.firstCall.args[0]).to.equal(
        'https://ty-eu-storage30-pic.oss-eu-central-1.aliyuncs.com/000000-000000000-pp00000000000000000000/detect/1783285843.jpeg?param=QUFBQUFBQUFBQUFBQQ==',
      );
      sinon.assert.calledWith(
        self.gladys.device.camera.setImage,
        'tuya-doorbell',
        `image/jpg;base64,${Buffer.from('jpeg-bytes').toString('base64')}`,
      );
    });

    it('downloads a Pulsar direct URL as-is without trying the candidate hosts', async () => {
      const url =
        'https://ty-eu-storage30-pic.s3.eu-central-1.amazonaws.com/000000/detect/1784367887.jpeg?X-Amz-Signature=abc';
      const axiosStub = { get: sinon.stub().resolves({ data: Buffer.from('jpeg-bytes') }) };
      const media = load(axiosStub);
      const self = buildSelf(media);

      const stored = await self.handleMediaValue(device, 'doorbell_pic', Buffer.from(url).toString('base64'));

      expect(stored).to.equal(true);
      sinon.assert.calledOnce(axiosStub.get);
      expect(axiosStub.get.firstCall.args[0]).to.equal(url);
      sinon.assert.calledWith(
        self.gladys.device.camera.setImage,
        'tuya-doorbell',
        `image/jpg;base64,${Buffer.from('jpeg-bytes').toString('base64')}`,
      );
    });

    it('falls back to the next storage host when the first one rejects the signed URL', async () => {
      const axiosStub = { get: sinon.stub() };
      axiosStub.get.onCall(0).rejects(Object.assign(new Error('forbidden'), { response: { status: 403 } }));
      axiosStub.get.onCall(1).resolves({ data: Buffer.from('jpeg-bytes') });
      const media = load(axiosStub);
      const self = buildSelf(media);

      const stored = await self.handleMediaValue(device, 'doorbell_pic', buildPayload());

      expect(stored).to.equal(true);
      expect(axiosStub.get.secondCall.args[0]).to.include('.s3.eu-central-1.amazonaws.com/');
      const failure = self.recordDiagnostic.getCalls().find((call) => call.args[2] === 'media_download_failed');
      expect(failure.args[3]).to.include('HTTP 403');
    });

    it('gives up when every storage host fails (expired signature case)', async () => {
      const axiosStub = { get: sinon.stub().rejects(new Error('timeout')) };
      const media = load(axiosStub);
      const self = buildSelf(media);

      const stored = await self.handleMediaValue(device, 'doorbell_pic', buildPayload());

      expect(stored).to.equal(false);
      expect(axiosStub.get.callCount).to.equal(3);
      sinon.assert.notCalled(self.gladys.device.camera.setImage);
    });

    it('skips invalid payloads and encrypted images', async () => {
      const axiosStub = { get: sinon.stub().resolves({ data: Buffer.from('jpeg-bytes') }) };
      const media = load(axiosStub);
      const self = buildSelf(media);

      expect(await self.handleMediaValue(device, 'doorbell_pic', 'not-a-payload')).to.equal(false);
      expect(
        await self.handleMediaValue(device, 'doorbell_pic', buildPayload({ files: [['/p.jpeg?param=x', 'aes-key']] })),
      ).to.equal(false);
      const encrypted = self.recordDiagnostic.getCalls().find((call) => call.args[2] === 'media_encrypted_unsupported');
      expect(encrypted).to.not.equal(undefined);
      sinon.assert.notCalled(self.gladys.device.camera.setImage);
    });

    it('re-encodes an oversized snapshot with ffmpeg and stores the compressed image', async () => {
      // 120KB of bytes -> base64 above the 150KB camera cap -> ffmpeg fallback (rtsp-camera recipe).
      const bigBuffer = Buffer.alloc(120 * 1024);
      const axiosStub = { get: sinon.stub().resolves({ data: bigBuffer }) };
      const execFile = sinon.stub().callsFake((bin, args, options, callback) => {
        // The stub plays ffmpeg's role: it writes the (now small) output file.
        fsSync.writeFileSync(args[args.length - 1], Buffer.from('small-jpeg'));
        callback(null);
      });
      const media = load(axiosStub, { execFile });
      const self = buildSelf(media);

      const stored = await self.handleMediaValue(device, 'doorbell_pic', buildPayload());

      expect(stored).to.equal(true);
      expect(execFile.firstCall.args[0]).to.equal('ffmpeg');
      expect(execFile.firstCall.args[1]).to.include('-qscale:v');
      sinon.assert.calledWith(
        self.gladys.device.camera.setImage,
        'tuya-doorbell',
        `image/jpg;base64,${Buffer.from('small-jpeg').toString('base64')}`,
      );
      const tooBig = self.recordDiagnostic.getCalls().find((call) => call.args[2] === 'media_image_too_big');
      expect(tooBig).to.not.equal(undefined);
    });

    it('reports an unusable snapshot when ffmpeg fails or no temp folder is available', async () => {
      const bigBuffer = Buffer.alloc(120 * 1024);
      const axiosStub = { get: sinon.stub().resolves({ data: bigBuffer }) };
      const execFile = sinon.stub().yields(new Error('ffmpeg: command not found'));
      const media = load(axiosStub, { execFile });
      const self = buildSelf(media);

      expect(await self.handleMediaValue(device, 'doorbell_pic', buildPayload())).to.equal(false);
      const unusable = self.recordDiagnostic.getCalls().find((call) => call.args[2] === 'media_image_unusable');
      expect(unusable).to.not.equal(undefined);
      sinon.assert.notCalled(self.gladys.device.camera.setImage);

      // Without a temp folder the re-encode cannot even start.
      const selfWithoutTemp = buildSelf(media);
      delete selfWithoutTemp.gladys.config;
      expect(await selfWithoutTemp.handleMediaValue(device, 'doorbell_pic', buildPayload())).to.equal(false);
    });

    it('reports a storage failure and works without the diagnostics collector', async () => {
      const axiosStub = { get: sinon.stub().resolves({ data: Buffer.from('jpeg-bytes') }) };
      const media = load(axiosStub);
      const self = buildSelf(media, { withDiagnostics: false });
      self.gladys.device.camera.setImage = sinon.stub().rejects(new Error('camera feature not found'));

      const stored = await self.handleMediaValue(device, 'doorbell_pic', buildPayload());

      expect(stored).to.equal(false);
    });
  });

  describe('processMediaCodes', () => {
    const media = mediaModule;

    it('seeds silently, skips unchanged/cleared payloads and fires on a new one', async () => {
      const self = buildSelf(media);
      self.handleMediaValue = sinon.stub().resolves(true);

      // First observation: seed only (a payload seen at startup has an expired URL anyway).
      self.processMediaCodes(device, { movement_detect_pic: 'payload-1' });
      // Re-reported identical payload: silent.
      self.processMediaCodes(device, { movement_detect_pic: 'payload-1' });
      sinon.assert.notCalled(self.handleMediaValue);

      // New payload: one download.
      self.processMediaCodes(device, { movement_detect_pic: 'payload-2' });
      sinon.assert.calledOnceWithExactly(self.handleMediaValue, device, 'movement_detect_pic', 'payload-2');

      // Cleared payload: silent.
      self.processMediaCodes(device, { movement_detect_pic: '' });
      sinon.assert.calledOnce(self.handleMediaValue);
    });

    it('fires only once when the same image arrives as a Pulsar URL then a shadow JSON payload', () => {
      const self = buildSelf(media);
      self.handleMediaValue = sinon.stub().resolves(true);
      const imagePath = '/000000-000000000-pp00000000000000000000/detect/1784367887.jpeg';
      const pulsarPayload = Buffer.from(
        `https://ty-eu-storage30-pic.s3.eu-central-1.amazonaws.com${imagePath}?X-Amz-Signature=abc`,
      ).toString('base64');
      const shadowPayload = buildPayload({ files: [[`${imagePath}?param=QUFBQQ==`, '']] });

      self.processMediaCodes(device, { movement_detect_pic: 'seed' });
      self.processMediaCodes(device, { movement_detect_pic: pulsarPayload });
      self.processMediaCodes(device, { movement_detect_pic: shadowPayload });
      sinon.assert.calledOnce(self.handleMediaValue);

      // A DIFFERENT image path fires again.
      const nextRing = buildPayload({ files: [['/000000/detect/1784368111.jpeg?param=QUFBQQ==', '']] });
      self.processMediaCodes(device, { movement_detect_pic: nextRing });
      sinon.assert.calledTwice(self.handleMediaValue);
    });

    it('fires the doorbell CLICK event on a new ring snapshot', () => {
      const self = buildSelf(media);
      self.handleMediaValue = sinon.stub().resolves(true);
      self.gladys.event = { emit: sinon.stub() };
      const ringDevice = {
        external_id: 'tuya:doorbell-id',
        selector: 'tuya-doorbell',
        features: [{ external_id: 'tuya:doorbell-id:doorbell_active', category: 'button', type: 'click' }],
      };

      // Seed: no ghost ring at startup.
      self.processMediaCodes(ringDevice, { doorbell_pic: 'ring-seed' });
      sinon.assert.notCalled(self.gladys.event.emit);

      self.processMediaCodes(ringDevice, { doorbell_pic: 'ring-1' });
      sinon.assert.calledOnce(self.gladys.event.emit);
      const [eventName, payload] = self.gladys.event.emit.firstCall.args;
      expect(eventName).to.equal('device.new-state');
      expect(payload).to.deep.equal({
        device_feature_external_id: 'tuya:doorbell-id:doorbell_active',
        state: 1,
      });

      // A motion snapshot never fires the ring.
      self.processMediaCodes(ringDevice, { movement_detect_pic: 'motion-seed' });
      self.processMediaCodes(ringDevice, { movement_detect_pic: 'motion-1' });
      sinon.assert.calledOnce(self.gladys.event.emit);

      // Without the ring feature (or event emitter), no crash and no emit.
      self.processMediaCodes(device, { doorbell_pic: 'ring-seed' });
      self.processMediaCodes(device, { doorbell_pic: 'ring-2' });
      sinon.assert.calledOnce(self.gladys.event.emit);
    });

    it('ignores unrelated values and tolerates a failing handler', async () => {
      const self = buildSelf(media);
      self.handleMediaValue = sinon.stub().rejects(new Error('boom'));

      self.processMediaCodes(device, null);
      self.processMediaCodes(null, { movement_detect_pic: 'x' });
      self.processMediaCodes(device, { switch_1: true });
      sinon.assert.notCalled(self.handleMediaValue);

      self.processMediaCodes(device, { doorbell_pic: 'seed' });
      self.processMediaCodes(device, { doorbell_pic: 'ring-1' });
      sinon.assert.calledOnce(self.handleMediaValue);
      // The rejection is swallowed by the fire-and-forget catch.
      await new Promise((resolve) => {
        setImmediate(resolve);
      });
    });
  });
});
