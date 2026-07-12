const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate updateCameraImage', () => {
  let gladys;
  let frigateManager;

  beforeEach(() => {
    gladys = {
      stateManager: {
        get: fake.returns({ selector: 'frigate-c660', external_id: 'frigate:c660' }),
      },
      device: {
        camera: {
          setImage: fake.resolves(null),
        },
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.getImage = fake.resolves('image/webp;base64,xxx');
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should refresh the image of the camera device', async () => {
    await frigateManager.updateCameraImage('c660');

    assert.calledOnceWithExactly(gladys.stateManager.get, 'deviceByExternalId', 'frigate:c660');
    assert.calledOnceWithExactly(gladys.device.camera.setImage, 'frigate-c660', 'image/webp;base64,xxx');
  });

  it('should do nothing when the camera device is unknown', async () => {
    gladys.stateManager.get = fake.returns(null);

    await frigateManager.updateCameraImage('unknown');

    assert.notCalled(gladys.device.camera.setImage);
  });

  it('should not throw when the image cannot be fetched', async () => {
    frigateManager.getImage = fake.rejects(new Error('camera offline'));

    await frigateManager.updateCameraImage('c660');

    assert.notCalled(gladys.device.camera.setImage);
  });
});
