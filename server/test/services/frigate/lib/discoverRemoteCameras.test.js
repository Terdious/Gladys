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
          cam_already_there: {
            friendly_name: 'Cam Boxes',
            objects: { track: ['person', 'unicorn'] },
            ffmpeg: { inputs: [{ path: 'rtsp://user:pass@10.6.0.8:554/live/profile.0' }] },
          },
          cam_new: { objects: { track: ['dog', 'car'] }, ffmpeg: { inputs: [{ path: 'not a url at all' }] } },
          cam_without_objects: {},
          cam_without_track: { objects: {} },
          cam_bad_input: { ffmpeg: { inputs: [{ path: 42 }] } },
        },
      },
    });
  });

  it('should list the remote cameras with their trackable labels', async () => {
    const cameras = await frigateManager.discoverRemoteCameras();

    expect(cameras).to.deep.equal([
      {
        name: 'cam_already_there',
        friendlyName: 'Cam Boxes',
        sourceHost: '10.6.0.8',
        trackedLabels: ['person'],
        alreadyImported: true,
      },
      { name: 'cam_new', friendlyName: null, sourceHost: null, trackedLabels: ['dog', 'car'], alreadyImported: false },
      { name: 'cam_without_objects', friendlyName: null, sourceHost: null, trackedLabels: [], alreadyImported: false },
      { name: 'cam_without_track', friendlyName: null, sourceHost: null, trackedLabels: [], alreadyImported: false },
      { name: 'cam_bad_input', friendlyName: null, sourceHost: null, trackedLabels: [], alreadyImported: false },
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
