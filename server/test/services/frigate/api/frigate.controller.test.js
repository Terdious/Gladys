const sinon = require('sinon');
const { assert: chaiAssert } = require('chai');
const proxyquire = require('proxyquire').noCallThru();
const fse = require('fs-extra');
const path = require('path');
const EventEmitter = require('events');

const { assert, fake } = sinon;
const FrigateController = require('../../../../services/frigate/api/frigate.controller');

const FrigateControllerWithFsMocked = proxyquire('../../../../services/frigate/api/frigate.controller', {
  fs: {
    createReadStream: () => {
      const event = new EventEmitter();
      // @ts-ignore
      event.pipe = () => event.emit('error');
      return event;
    },
  },
});

const gladys = {
  event: {
    emit: fake.resolves(null),
  },
  config: {
    tempFolder: process.env.TEMP_FOLDER || '/tmp/gladys',
  },
};

const frigateManager = {
  status: fake.returns({ frigateEnabled: true }),
  stats: { service: { version: '0.17.2' } },
  setEnabled: fake.resolves(null),
  init: fake.resolves(null),
  disconnect: fake.resolves(null),
  startStreamingIfNotStarted: fake.resolves({}),
  stopStreaming: fake.resolves(null),
  liveActivePing: fake.resolves(null),
};

describe('frigate API', () => {
  let controller;

  beforeEach(() => {
    controller = FrigateController(gladys, frigateManager);
    sinon.reset();
  });

  it('get /api/v1/service/frigate/status', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['get /api/v1/service/frigate/status'].controller(req, res);

    assert.calledOnce(frigateManager.status);
    assert.calledWith(res.json, { frigateEnabled: true });
  });

  it('get /api/v1/service/frigate/stats', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['get /api/v1/service/frigate/stats'].controller(req, res);

    assert.calledWith(res.json, frigateManager.stats);
  });

  it('post /api/v1/service/frigate/connect', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/connect'].controller(req, res);

    assert.calledOnceWithExactly(frigateManager.setEnabled, true);
    assert.calledOnce(frigateManager.init);
    assert.calledWith(res.json, { success: true });
  });

  it('post /api/v1/service/frigate/disconnect', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/disconnect'].controller(req, res);

    assert.calledOnceWithExactly(frigateManager.setEnabled, false);
    assert.calledOnce(frigateManager.disconnect);
    assert.calledWith(res.json, { success: true });
  });

  it('post /api/v1/service/frigate/config/apply', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/config/apply'].controller(req, res);

    assert.calledOnce(frigateManager.init);
    assert.calledWith(res.json, { success: true });
  });

  it('post .../camera/:camera_selector/streaming/start', async () => {
    const req = {
      params: {
        camera_selector: 'my-camera',
      },
      body: {
        is_gladys_gateway: false,
        segment_duration: 4,
      },
    };
    const res = {
      send: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/camera/:camera_selector/streaming/start'].controller(req, res);

    assert.calledWith(frigateManager.startStreamingIfNotStarted, 'my-camera', false, 4);
  });

  it('post .../camera/:camera_selector/streaming/stop', async () => {
    const req = {
      params: {
        camera_selector: 'my-camera',
      },
    };
    const res = {
      send: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/camera/:camera_selector/streaming/stop'].controller(req, res);

    assert.calledWith(frigateManager.stopStreaming, 'my-camera');
    assert.calledWith(res.send, { success: true });
  });

  it('post .../camera/:camera_selector/streaming/ping', async () => {
    const req = {
      params: {
        camera_selector: 'my-camera',
      },
    };
    const res = {
      send: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/camera/:camera_selector/streaming/ping'].controller(req, res);

    assert.calledWith(frigateManager.liveActivePing, 'my-camera');
    assert.calledWith(res.send, { success: true });
  });

  it('get .../camera/streaming/:folder/:file should stream index.m3u8', async () => {
    const req = {
      params: {
        folder: 'camera-frigate-controller-test',
        file: 'index.m3u8',
      },
    };
    await fse.ensureDir(path.join(gladys.config.tempFolder, 'camera-frigate-controller-test'));
    await fse.writeFile(
      path.join(gladys.config.tempFolder, 'camera-frigate-controller-test', 'index.m3u8'),
      'test-toto-content',
    );
    const resWriteStream = fse.createWriteStream(
      path.join(gladys.config.tempFolder, 'camera-frigate-controller-test', 'result.txt'),
    );

    await controller['get /api/v1/service/frigate/camera/streaming/:folder/:file'].controller(req, resWriteStream);
  });

  it('get .../camera/streaming/:folder/:file should stream index1.ts', async () => {
    const req = {
      params: {
        folder: 'camera-frigate-controller-test',
        file: 'index1.ts',
      },
    };
    await fse.ensureDir(path.join(gladys.config.tempFolder, 'camera-frigate-controller-test'));
    await fse.writeFile(
      path.join(gladys.config.tempFolder, 'camera-frigate-controller-test', 'index1.ts'),
      'test-toto-content',
    );
    const resWriteStream = fse.createWriteStream(
      path.join(gladys.config.tempFolder, 'camera-frigate-controller-test', 'result.txt'),
    );

    await controller['get /api/v1/service/frigate/camera/streaming/:folder/:file'].controller(req, resWriteStream);
  });

  it('get .../camera/streaming/:folder/:file should return 404, file not found (res.status)', async () => {
    const mockedController = FrigateControllerWithFsMocked(gladys, frigateManager);
    const req = {
      params: {
        folder: 'camera-frigate-controller-test',
        file: 'index12212.ts',
      },
    };
    const resWriteStream = fse.createWriteStream(
      path.join(gladys.config.tempFolder, 'camera-frigate-controller-test', 'result.txt'),
    );
    const end = fake.returns(null);
    // @ts-ignore
    resWriteStream.status = fake.returns({
      end,
    });

    await mockedController['get /api/v1/service/frigate/camera/streaming/:folder/:file'].controller(
      req,
      resWriteStream,
    );

    // @ts-ignore
    assert.calledWith(resWriteStream.status, 404);
    assert.calledOnce(end);
  });

  it('get .../camera/streaming/:folder/:file should return 404, file not found (throw error)', async () => {
    const req = {};
    const resWriteStream = {};

    const promise = controller['get /api/v1/service/frigate/camera/streaming/:folder/:file'].controller(
      req,
      resWriteStream,
    );

    await chaiAssert.isRejected(promise, 'FILE_NOT_FOUND');
  });

  it('get .../camera/streaming/:folder/:file should return 400, invalid filename', async () => {
    const req = {
      params: {
        folder: 'camera-frigate-controller-test',
        file: 'lalalalala',
      },
    };
    const resWriteStream = {};

    const promise = controller['get /api/v1/service/frigate/camera/streaming/:folder/:file'].controller(
      req,
      resWriteStream,
    );

    await chaiAssert.isRejected(promise, 'Invalid filename');
  });

  it('get .../camera/streaming/:folder/:file should return 400, invalid session id', async () => {
    const req = {
      params: {
        folder: '.....',
        file: 'lalalalala',
      },
    };
    const resWriteStream = {};

    const promise = controller['get /api/v1/service/frigate/camera/streaming/:folder/:file'].controller(
      req,
      resWriteStream,
    );

    await chaiAssert.isRejected(promise, 'Invalid session id');
  });
});
