const { expect, assert } = require('chai');
const fse = require('fs-extra');
const path = require('path');
const { fake, assert: fakeAssert } = require('sinon');

const FrigateManager = require('../../../../services/frigate/lib');
const { NotFoundError, ServiceNotConfiguredError } = require('../../../../utils/coreErrors');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const device = {
  id: 'a6fb4cb8-ccc2-4234-a752-b25d1eb5ab6b',
  selector: 'my-camera',
  external_id: 'frigate:my_camera',
  params: [],
};

const gladys = {
  config: {
    tempFolder: process.env.TEMP_FOLDER || '/tmp/gladys',
  },
  gateway: {
    gladysGatewayClient: {
      cameraCleanSession: fake.resolves(null),
    },
  },
  device: {
    getBySelector: fake.resolves(device),
  },
};

const childProcessMock = {
  spawn: (command, args, options) => {
    const writeFile = () => {
      const filePath = args.find((arg) => arg.endsWith('index.m3u8'));
      if (filePath) {
        fse.writeFileSync(filePath, 'hello');
      }
    };
    setTimeout(writeFile, 10);
    return {
      kill: fake.returns(null),
      stdout: {
        on: (type, cb) => {
          cb('log log log');
        },
      },
      stderr: {
        on: (type, cb) => {
          cb('stderr log log');
        },
      },
      on: (type, cb) => {},
    };
  },
};

describe('frigate streaming', () => {
  let frigateManager;
  before(async () => {
    await fse.ensureDir(gladys.config.tempFolder);
  });
  beforeEach(() => {
    frigateManager = new FrigateManager(gladys, null, serviceId, childProcessMock);
    frigateManager.frigateRtspPort = 8554;
  });
  afterEach(() => {
    // remove interval
    if (frigateManager.checkIfLiveActiveInterval) {
      clearInterval(frigateManager.checkIfLiveActiveInterval);
    }
  });
  it('should not start in remote mode (v1 limitation)', async () => {
    frigateManager.mode = 'remote';
    const promise = frigateManager.startStreaming('my-camera', false, 1);
    await assert.isRejected(promise, ServiceNotConfiguredError);
    expect(frigateManager.liveStreams.size).to.equal(0);
  });

  it('should not start, rtsp port not allocated', async () => {
    frigateManager.frigateRtspPort = null;
    const promise = frigateManager.startStreaming('my-camera', false, 1);
    await assert.isRejected(promise, ServiceNotConfiguredError);
    expect(frigateManager.liveStreams.size).to.equal(0);
  });
  it('should not start, device has no external_id', async () => {
    const wrongGladys = {
      config: gladys.config,
      device: {
        getBySelector: fake.resolves({
          id: 'a6fb4cb8-ccc2-4234-a752-b25d1eb5ab6b',
          selector: 'my-camera',
          params: [],
        }),
      },
    };
    frigateManager = new FrigateManager(wrongGladys, null, serviceId, childProcessMock);
    frigateManager.frigateRtspPort = 8554;
    const promise = frigateManager.startStreaming('my-camera', false, 1);
    await assert.isRejected(promise, NotFoundError);
    expect(frigateManager.liveStreams.size).to.equal(0);
  });
  it('should not start, device is not managed by Frigate', async () => {
    const wrongGladys = {
      config: gladys.config,
      device: {
        getBySelector: fake.resolves({
          id: 'a6fb4cb8-ccc2-4234-a752-b25d1eb5ab6b',
          selector: 'my-camera',
          external_id: 'netatmo:camera',
          params: [],
        }),
      },
    };
    frigateManager = new FrigateManager(wrongGladys, null, serviceId, childProcessMock);
    frigateManager.frigateRtspPort = 8554;
    const promise = frigateManager.startStreaming('my-camera', false, 1);
    await assert.isRejected(promise, NotFoundError);
    expect(frigateManager.liveStreams.size).to.equal(0);
  });
  it('should start, ping & stop streaming', async () => {
    frigateManager.onNewCameraFile = fake.resolves(null);
    const liveStreamingProcess = await frigateManager.startStreaming('my-camera', false, 1);
    expect(liveStreamingProcess).to.have.property('camera_folder');
    expect(liveStreamingProcess).to.have.property('encryption_key');
    await frigateManager.liveActivePing('my-camera');
    await frigateManager.stopStreaming('my-camera');
    fakeAssert.called(frigateManager.onNewCameraFile);
  });
  it('should start with default segment duration & stop streaming', async () => {
    frigateManager.onNewCameraFile = fake.resolves(null);
    const liveStreamingProcess = await frigateManager.startStreaming('my-camera', false);
    expect(liveStreamingProcess).to.have.property('camera_folder');
    expect(liveStreamingProcess).to.have.property('encryption_key');
    await frigateManager.stopStreaming('my-camera');
  });
  it('should start, ping & stop streaming (gateway on)', async () => {
    frigateManager.sendCameraFileToGatewayLimited = fake.resolves(null);
    const liveStreamingProcess = await frigateManager.startStreaming('my-camera', true, 1);
    expect(liveStreamingProcess).to.have.property('camera_folder');
    expect(liveStreamingProcess).to.have.property('encryption_key');
    await frigateManager.liveActivePing('my-camera');
    await frigateManager.stopStreaming('my-camera');
    fakeAssert.called(frigateManager.sendCameraFileToGatewayLimited);
  });
  it('should return existing stream when starting twice', async () => {
    frigateManager.onNewCameraFile = fake.resolves(null);
    frigateManager.convertLocalStreamToGateway = fake.resolves(null);
    const firstStream = await frigateManager.startStreaming('my-camera', false, 1);
    const secondStream = await frigateManager.startStreaming('my-camera', false, 1);
    expect(secondStream).to.deep.equal(firstStream);
    fakeAssert.notCalled(frigateManager.convertLocalStreamToGateway);
    // A new request coming from Gladys Plus converts the local stream
    const thirdStream = await frigateManager.startStreaming('my-camera', true, 1);
    expect(thirdStream).to.deep.equal(firstStream);
    fakeAssert.calledOnce(frigateManager.convertLocalStreamToGateway);
    await frigateManager.stopStreaming('my-camera');
  });
  it('should start streaming two cameras at the same time', async () => {
    frigateManager.onNewCameraFile = fake.resolves(null);
    frigateManager.gladys = {
      config: gladys.config,
      device: {
        getBySelector: (selector) =>
          Promise.resolve({
            id: selector,
            selector,
            external_id: `frigate:${selector}`,
            params: [],
          }),
      },
    };
    const firstStream = await frigateManager.startStreaming('camera-one', false, 1);
    const secondStream = await frigateManager.startStreaming('camera-two', false, 1);
    expect(firstStream).to.have.property('camera_folder');
    expect(secondStream).to.have.property('camera_folder');
    expect(secondStream.camera_folder).to.not.equal(firstStream.camera_folder);
    await frigateManager.stopStreaming('camera-one');
    await frigateManager.stopStreaming('camera-two');
  });
  it('should ping and get 404', async () => {
    const promise = frigateManager.liveActivePing('lalalallala');
    await assert.isRejected(promise, NotFoundError);
  });
  it('should start, ping, verify for last ping and stop streaming', async () => {
    await frigateManager.startStreaming('my-camera', false, 1);
    await frigateManager.liveActivePing('my-camera');
    // A live with a recent ping is kept alive
    await frigateManager.checkIfLiveActive();
    expect(frigateManager.liveStreams.size).to.equal(1);
    const liveStream = frigateManager.liveStreams.get('my-camera');
    frigateManager.liveStreams.set('my-camera', { ...liveStream, lastPing: Date.now() - 120 * 1000 });
    await frigateManager.checkIfLiveActive();
    expect(frigateManager.liveStreams.size).to.equal(0);
  });
  it('should start streaming if not started', async () => {
    const [liveStreamingProcess1, liveStreamingProcess2, liveStreamingProcess3] = await Promise.all([
      frigateManager.startStreamingIfNotStarted('my-camera', false, 1),
      frigateManager.startStreamingIfNotStarted('my-camera', false, 1),
      frigateManager.startStreamingIfNotStarted('my-camera', false, 1),
    ]);
    expect(liveStreamingProcess1).to.have.property('camera_folder');
    expect(liveStreamingProcess1).to.have.property('encryption_key');
    expect(liveStreamingProcess2).to.deep.equal(liveStreamingProcess1);
    expect(liveStreamingProcess3).to.deep.equal(liveStreamingProcess1);
    await frigateManager.stopStreaming('my-camera');
  });
  it('should start streaming only once', async () => {
    frigateManager.startStreaming = fake.resolves({});
    await Promise.all([
      frigateManager.startStreamingIfNotStarted('my-camera', false, 1),
      frigateManager.startStreamingIfNotStarted('my-camera', false, 1),
      frigateManager.startStreamingIfNotStarted('my-camera', false, 1),
    ]);
    fakeAssert.calledOnce(frigateManager.startStreaming);
  });
  it('should clean starting map when start fails', async () => {
    frigateManager.startStreaming = fake.rejects(new Error('test'));
    const promise = frigateManager.startStreamingIfNotStarted('my-camera', false, 1);
    await assert.isRejected(promise, 'test');
    expect(frigateManager.liveStreamsStarting.size).to.equal(0);
  });
  it('should start streaming locally, then convert local stream to online stream during init', async () => {
    frigateManager.convertLocalStreamToGateway = fake.resolves(null);
    const promise = frigateManager.startStreamingIfNotStarted('my-camera', false, 1);
    const promiseGateway = frigateManager.startStreamingIfNotStarted('my-camera', true, 1);
    await Promise.all([promise, promiseGateway]);
    fakeAssert.calledOnce(frigateManager.convertLocalStreamToGateway);
  });
  it('should start streaming locally, then convert local stream to online stream after stream started', async () => {
    frigateManager.convertLocalStreamToGateway = fake.resolves(null);
    await frigateManager.startStreamingIfNotStarted('my-camera', false, 1);
    await frigateManager.startStreamingIfNotStarted('my-camera', true, 1);
    fakeAssert.calledOnce(frigateManager.convertLocalStreamToGateway);
    await frigateManager.stopStreaming('my-camera');
  });
  it('should start streaming and should crash immediately', async () => {
    const childProcessMockWithCrash = {
      spawn: (command, args, options) => {
        return {
          stdout: {
            on: (type, cb) => {
              cb('log log log');
            },
          },
          stderr: {
            on: (type, cb) => {
              cb('stderr log log');
            },
          },
          on: (type, cb) => {
            // Exit with code 100
            setTimeout(() => cb(100), 5);
          },
        };
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId, childProcessMockWithCrash);
    frigateManager.frigateRtspPort = 8554;
    const promise = frigateManager.startStreamingIfNotStarted('my-camera', false, 1);
    await assert.isRejected(promise, 'Child process exited with code 100');
    expect(frigateManager.liveStreams.size).to.equal(0);
  });
  it('should start streaming, then ffmpeg crashes after the live started', async () => {
    const childProcessMockWithLateCrash = {
      spawn: (command, args, options) => {
        const writeFile = () => {
          const filePath = args.find((arg) => arg.endsWith('index.m3u8'));
          if (filePath) {
            fse.writeFileSync(filePath, 'hello');
          }
        };
        setTimeout(writeFile, 5);
        return {
          kill: fake.returns(null),
          stdout: {
            on: (type, cb) => {
              cb('log log log');
            },
          },
          stderr: {
            on: (type, cb) => {
              cb('stderr log log');
            },
          },
          on: (type, cb) => {
            // Exit with code 1 after the index was written
            setTimeout(() => cb(1), 30);
          },
        };
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId, childProcessMockWithLateCrash);
    frigateManager.frigateRtspPort = 8554;
    await frigateManager.startStreamingIfNotStarted('my-camera', false, 1);
    expect(frigateManager.liveStreams.size).to.equal(1);
    // Wait for the crash: the live should be cleaned
    await new Promise((resolve) => {
      setTimeout(resolve, 60);
    });
    expect(frigateManager.liveStreams.size).to.equal(0);
  });
  it('should start streaming and write multiple time the index', async () => {
    const childProcessMockWithDoubleWrite = {
      spawn: (command, args, options) => {
        const writeFile = () => {
          const filePath = args.find((arg) => arg.endsWith('index.m3u8'));
          if (filePath) {
            fse.writeFileSync(filePath, 'hello');
            fse.writeFileSync(filePath, 'hello');
          }
        };
        setTimeout(writeFile, 5);
        return {
          stdout: {
            on: (type, cb) => {
              cb('log log log');
            },
          },
          stderr: {
            on: (type, cb) => {
              cb('stderr log log');
            },
          },
          on: (type, cb) => {},
        };
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId, childProcessMockWithDoubleWrite);
    frigateManager.frigateRtspPort = 8554;
    await frigateManager.startStreamingIfNotStarted('my-camera', false, 1);
  });
  it('should emit gateway-ready after a local live was converted to a gateway live', async () => {
    frigateManager.sendCameraFileToGatewayLimited = fake.resolves(null);
    // Start a local live: it resolves on index-ready
    await frigateManager.startStreaming('my-camera', false, 1);
    // Convert it to a gateway live, then a new index write triggers a gateway-ready
    // emission on an already resolved live
    await frigateManager.convertLocalStreamToGateway('my-camera');
    const { fullFolderPath } = frigateManager.liveStreams.get('my-camera');
    fse.writeFileSync(path.join(fullFolderPath, 'index.m3u8'), 'hello again');
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    fakeAssert.called(frigateManager.sendCameraFileToGatewayLimited);
    await frigateManager.stopStreaming('my-camera');
  });
  it('should stop streaming a live without abortable watcher', async () => {
    frigateManager.liveStreams.set('my-camera', {
      isGladysGateway: false,
      liveStreamingProcess: {
        kill: fake.returns(null),
      },
      watchAbortController: {},
      fullFolderPath: path.join(gladys.config.tempFolder, 'camera-frigate-no-abort'),
    });
    await frigateManager.stopStreaming('my-camera');
    expect(frigateManager.liveStreams.size).to.equal(0);
  });
  it('should stop streaming, but kill + clean is not working', async () => {
    const gladysWithFailClean = {
      config: gladys.config,
      gateway: {
        gladysGatewayClient: {
          cameraCleanSession: fake.rejects('CANNOT CLEAN'),
        },
      },
      device: {
        getBySelector: fake.resolves(device),
      },
    };
    frigateManager = new FrigateManager(gladysWithFailClean, null, serviceId, childProcessMock);
    frigateManager.frigateRtspPort = 8554;
    frigateManager.liveStreams.set('my-camera', {
      isGladysGateway: true,
      liveStreamingProcess: {
        kill: fake.throws('CANNOT KILL!'),
      },
      watchAbortController: {
        abort: fake.returns(null),
      },
      fullFolderPath: path.join(gladys.config.tempFolder, 'lalalalallalala'),
    });
    await frigateManager.stopStreaming('my-camera');
    expect(frigateManager.liveStreams.size).to.equal(0);
  });
  it('should return even if stream does not exist in stopStreaming', async () => {
    await frigateManager.stopStreaming('unknown stream');
  });
});
