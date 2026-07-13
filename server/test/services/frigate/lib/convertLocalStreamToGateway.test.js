const { expect, assert } = require('chai');
const fse = require('fs-extra');
const path = require('path');
const { fake, assert: fakeAssert } = require('sinon');

const FrigateManager = require('../../../../services/frigate/lib');
const { NotFoundError } = require('../../../../utils/coreErrors');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const gladys = {
  config: {
    tempFolder: process.env.TEMP_FOLDER || '/tmp/gladys',
  },
};

describe('frigate convertLocalStreamToGateway', () => {
  const folderName = 'camera-frigate-convert-a10bca14-fa0e-4484-b6ad';
  const folderPath = path.join(gladys.config.tempFolder, folderName);
  const indexFilePath = path.join(folderPath, 'index.m3u8');
  const keyfilePath = path.join(folderPath, 'index.m3u8.key');
  const videoFilePath = path.join(folderPath, 'index0.ts');
  const frigateManager = new FrigateManager(gladys, null, serviceId, {});
  before(async () => {
    await fse.ensureDir(folderPath);
    await fse.writeFile(indexFilePath, 'this is index');
    await fse.writeFile(keyfilePath, 'this is a key');
    await fse.writeFile(videoFilePath, 'this is a video');
    // Directories in the live folder are ignored during the conversion
    await fse.ensureDir(path.join(folderPath, 'a-directory'));
  });
  after(async () => {
    await fse.remove(folderPath);
  });
  it('should return not found', async () => {
    const promise = frigateManager.convertLocalStreamToGateway('my-camera');
    await assert.isRejected(promise, NotFoundError);
  });
  it('should not upload anything when the stream has no folder yet', async () => {
    frigateManager.liveStreams.set('my-camera', {
      isGladysGateway: false,
    });
    frigateManager.onNewCameraFile = fake.resolves(null);
    await frigateManager.convertLocalStreamToGateway('my-camera');
    fakeAssert.notCalled(frigateManager.onNewCameraFile);
    expect(frigateManager.liveStreams.get('my-camera')).to.have.property('isGladysGateway', true);
    frigateManager.liveStreams.delete('my-camera');
  });
  it('should upload 3 files to gateway', async () => {
    frigateManager.liveStreams.set('my-camera', {
      isGladysGateway: false,
      cameraFolder: folderName,
      fullFolderPath: folderPath,
    });
    frigateManager.onNewCameraFile = fake.resolves(null);
    await frigateManager.convertLocalStreamToGateway('my-camera');
    fakeAssert.callCount(frigateManager.onNewCameraFile, 3);
    expect(frigateManager.liveStreams.get('my-camera')).to.have.property('isGladysGateway', true);
  });
});
