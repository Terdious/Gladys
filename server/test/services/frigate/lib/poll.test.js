const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate poll', () => {
  let gladys;
  let frigateManager;

  beforeEach(() => {
    gladys = {
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

  it('should refresh the camera image', async () => {
    const device = { selector: 'frigate-c660', external_id: 'frigate:c660' };

    await frigateManager.poll(device);

    assert.calledOnceWithExactly(frigateManager.getImage, device);
    assert.calledOnceWithExactly(gladys.device.camera.setImage, 'frigate-c660', 'image/webp;base64,xxx');
  });

  it('should not throw when the image cannot be fetched', async () => {
    frigateManager.getImage = fake.rejects(new Error('camera offline'));

    await frigateManager.poll({ selector: 'frigate-c660', external_id: 'frigate:c660' });

    assert.notCalled(gladys.device.camera.setImage);
  });
});
