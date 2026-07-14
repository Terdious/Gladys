const { expect, assert } = require('chai');
const { fake } = require('sinon');

const FrigateManager = require('../../../../services/frigate/lib');
const { ServiceNotConfiguredError } = require('../../../../utils/coreErrors');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate discoverRemoteCameras', () => {
  let frigateManager;

  beforeEach(() => {
    const gladys = {
      stateManager: {
        get: fake((key, value) => (value === 'frigate:cam_already_there' ? { selector: 'cam' } : null)),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.mode = 'remote';
    frigateManager.remoteApiGet = fake.resolves({
      data: {
        cameras: {
          cam_already_there: { objects: { track: ['person', 'unicorn'] } },
          cam_new: { objects: { track: ['dog', 'car'] } },
          cam_without_objects: {},
          cam_without_track: { objects: {} },
        },
      },
    });
  });

  it('should list the remote cameras with their trackable labels', async () => {
    const cameras = await frigateManager.discoverRemoteCameras();

    expect(cameras).to.deep.equal([
      { name: 'cam_already_there', trackedLabels: ['person'], alreadyImported: true },
      { name: 'cam_new', trackedLabels: ['dog', 'car'], alreadyImported: false },
      { name: 'cam_without_objects', trackedLabels: [], alreadyImported: false },
      { name: 'cam_without_track', trackedLabels: [], alreadyImported: false },
    ]);
  });

  it('should return an empty list when the remote config has no cameras', async () => {
    frigateManager.remoteApiGet = fake.resolves({ data: {} });

    const cameras = await frigateManager.discoverRemoteCameras();

    expect(cameras).to.deep.equal([]);
  });

  it('should reject when not in remote mode', async () => {
    frigateManager.mode = 'local';

    await assert.isRejected(frigateManager.discoverRemoteCameras(), ServiceNotConfiguredError);
  });
});
