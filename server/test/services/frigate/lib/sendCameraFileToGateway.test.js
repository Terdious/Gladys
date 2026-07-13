const { fake, assert: fakeAssert } = require('sinon');

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const gladys = {
  config: {
    tempFolder: process.env.TEMP_FOLDER || '/tmp/gladys',
  },
  gateway: {
    gladysGatewayClient: {
      cameraUploadFile: fake.resolves(null),
    },
  },
};

describe('frigate sendCameraFileToGateway', () => {
  it('should upload 1 file', async () => {
    const frigateManager = new FrigateManager(gladys, null, serviceId, {});
    await frigateManager.sendCameraFileToGateway(
      'camera-76561cdf-1e94-47c9-96b0-341b2d7e8d11',
      'filename',
      Buffer.from('lala', 'utf8'),
    );
    fakeAssert.calledWith(
      gladys.gateway.gladysGatewayClient.cameraUploadFile,
      'camera-76561cdf-1e94-47c9-96b0-341b2d7e8d11',
      'filename',
      Buffer.from('lala', 'utf8'),
    );
  });
});
