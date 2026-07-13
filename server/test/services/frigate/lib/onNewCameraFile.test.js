const { expect } = require('chai');
const fse = require('fs-extra');
const path = require('path');
const { fake, assert: fakeAssert } = require('sinon');

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const gladys = {
  config: {
    tempFolder: process.env.TEMP_FOLDER || '/tmp/gladys',
  },
};

describe('frigate onNewCameraFile', () => {
  const folderName = 'camera-frigate-a10bca14-fa0e-4484-b6ad-fedef6fd897f';
  const folderPath = path.join(gladys.config.tempFolder, folderName);
  const indexFilePath = path.join(folderPath, 'index.m3u8');
  const keyfilePath = path.join(folderPath, 'index.m3u8.key');
  const videoFilePath = path.join(folderPath, 'index0.ts');
  let frigateManager;
  before(async () => {
    await fse.ensureDir(folderPath);
    await fse.writeFile(indexFilePath, 'this is index');
    await fse.writeFile(keyfilePath, 'this is a key');
    await fse.writeFile(videoFilePath, 'this is a video');
  });
  after(async () => {
    await fse.remove(folderPath);
  });
  beforeEach(() => {
    frigateManager = new FrigateManager(gladys, null, serviceId, {});
    frigateManager.sendCameraFileToGatewayLimited = fake.resolves(null);
  });
  it('should return directly, no live stream', async () => {
    const res = await frigateManager.onNewCameraFile('my-camera', folderPath, 'camera-folder', 'index.m3u8', {}, {});
    expect(res).to.equal(null);
    fakeAssert.notCalled(frigateManager.sendCameraFileToGatewayLimited);
  });
  it('should return directly, no filename', async () => {
    const res = await frigateManager.onNewCameraFile('my-camera', folderPath, 'camera-folder', null, {}, {});
    expect(res).to.equal(null);
    fakeAssert.notCalled(frigateManager.sendCameraFileToGatewayLimited);
  });
  it('should return directly for temp/key file', async () => {
    const res = await frigateManager.onNewCameraFile('my-camera', folderPath, folderName, 'index.m3u8.tmp', {}, {});
    expect(res).to.equal(null);
    const res2 = await frigateManager.onNewCameraFile('my-camera', folderPath, folderName, 'index.m3u8.key', {}, {});
    expect(res2).to.equal(null);
    fakeAssert.notCalled(frigateManager.sendCameraFileToGatewayLimited);
  });
  it('should return directly, not a Gladys Gateway live', async () => {
    frigateManager.liveStreams.set('my-camera', {
      isGladysGateway: false,
    });
    const res = await frigateManager.onNewCameraFile('my-camera', folderPath, folderName, 'index.m3u8', {}, {});
    expect(res).to.equal(null);
    fakeAssert.notCalled(frigateManager.sendCameraFileToGatewayLimited);
  });
  it('should upload index and have an event emitted', async () => {
    frigateManager.liveStreams.set('my-camera', {
      isGladysGateway: true,
    });
    const sharedObject = {};
    const eventEmitter = {
      emit: fake.returns(null),
    };
    await fse.writeFile(indexFilePath, 'this is index');
    const res = await frigateManager.onNewCameraFile(
      'my-camera',
      folderPath,
      folderName,
      'index.m3u8',
      sharedObject,
      eventEmitter,
    );
    expect(res).to.equal(null);
    fakeAssert.calledWith(
      frigateManager.sendCameraFileToGatewayLimited,
      folderName,
      'index.m3u8',
      Buffer.from('this is index', 'utf8'),
    );
    fakeAssert.calledWith(eventEmitter.emit, 'gateway-ready');
  });
  it('should upload a file that fail, and return null', async () => {
    frigateManager.sendCameraFileToGatewayLimited = fake.rejects(null);
    frigateManager.liveStreams.set('my-camera', {
      isGladysGateway: true,
    });
    const sharedObject = {};
    const eventEmitter = {};
    const res = await frigateManager.onNewCameraFile(
      'my-camera',
      folderPath,
      folderName,
      'index0.ts',
      sharedObject,
      eventEmitter,
    );
    expect(res).to.equal(null);
    fakeAssert.called(frigateManager.sendCameraFileToGatewayLimited);
  });
  it('should upload index and hot replace url in case of a mixed live (local&gateway)', async () => {
    await fse.writeFile(
      indexFilePath,
      `BACKEND_URL_TO_REPLACE/api/v1/service/frigate/camera/streaming/${folderName}/index.m3u8.key`,
    );
    frigateManager.liveStreams.set('my-camera', {
      isGladysGateway: true,
    });
    const sharedObject = {};
    const eventEmitter = {
      emit: fake.returns(null),
    };
    const res = await frigateManager.onNewCameraFile(
      'my-camera',
      folderPath,
      folderName,
      'index.m3u8',
      sharedObject,
      eventEmitter,
    );
    expect(res).to.equal(null);
    // Upload a second time, but should not emit gateway-ready
    const res2 = await frigateManager.onNewCameraFile(
      'my-camera',
      folderPath,
      folderName,
      'index.m3u8',
      sharedObject,
      eventEmitter,
    );
    expect(res2).to.equal(null);
    fakeAssert.calledWith(
      frigateManager.sendCameraFileToGatewayLimited,
      folderName,
      'index.m3u8',
      Buffer.from(`https://api.gladysgateway.com/cameras/${folderName}/index.m3u8.key`, 'utf8'),
    );
    fakeAssert.calledWith(eventEmitter.emit, 'gateway-ready');
    fakeAssert.calledOnce(eventEmitter.emit);
  });
});
