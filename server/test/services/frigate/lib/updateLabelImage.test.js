const sinon = require('sinon');

const { fake, assert } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate updateLabelImage', () => {
  let frigateManager;
  let gladys;

  beforeEach(() => {
    gladys = {
      stateManager: {
        get: fake((key, value) => {
          if (key === 'deviceFeatureByExternalId' && value === 'frigate:c660:person:image') {
            return { selector: 'frigate-c660-person-image' };
          }
          if (key === 'deviceByExternalId' && value === 'frigate:c660') {
            return { selector: 'frigate-c660' };
          }
          return null;
        }),
      },
      device: {
        camera: {
          setImage: fake.resolves(null),
        },
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should store the label snapshot in the dedicated image feature', async () => {
    const imageBuffer = Buffer.from('jpeg-data');

    await frigateManager.updateLabelImage('c660', 'person', imageBuffer);

    assert.calledWith(
      gladys.device.camera.setImage,
      'frigate-c660',
      `image/jpeg;base64,${imageBuffer.toString('base64')}`,
      'frigate-c660-person-image',
    );
  });

  it('should do nothing when the label has no image feature', async () => {
    await frigateManager.updateLabelImage('c660', 'dog', Buffer.from('jpeg-data'));

    assert.notCalled(gladys.device.camera.setImage);
  });

  it('should do nothing when the camera device is unknown', async () => {
    gladys.stateManager.get = fake((key, value) =>
      key === 'deviceFeatureByExternalId' && value === 'frigate:c660:person:image'
        ? { selector: 'frigate-c660-person-image' }
        : null,
    );

    await frigateManager.updateLabelImage('c660', 'person', Buffer.from('jpeg-data'));

    assert.notCalled(gladys.device.camera.setImage);
  });

  it('should not throw when the image cannot be stored', async () => {
    gladys.device.camera.setImage = fake.rejects(new Error('Image is too big'));

    await frigateManager.updateLabelImage('c660', 'person', Buffer.from('jpeg-data'));

    assert.called(gladys.device.camera.setImage);
  });
});
