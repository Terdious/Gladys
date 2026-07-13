const { assert } = require('chai');
const { fake, assert: fakeAssert } = require('sinon');

const FrigateManager = require('../../../../services/frigate/lib');
const { NotFoundError, ServiceNotConfiguredError, BadParameters } = require('../../../../utils/coreErrors');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const device = {
  id: 'a6fb4cb8-ccc2-4234-a752-b25d1eb5ab6b',
  selector: 'my-camera',
  external_id: 'frigate:my_camera',
  params: [],
};

describe('frigate sendPtzCommand', () => {
  let frigateManager;

  beforeEach(() => {
    const gladys = {
      device: {
        getBySelector: fake.resolves(device),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.gladysConnected = true;
    frigateManager.mqttClient = {
      publish: fake.returns(null),
    };
  });

  it('should publish a move command on the camera ptz topic', async () => {
    await frigateManager.sendPtzCommand('my-camera', 'MOVE_LEFT');

    fakeAssert.calledWith(frigateManager.mqttClient.publish, 'frigate/my_camera/ptz', 'MOVE_LEFT');
  });

  it('should publish a preset command', async () => {
    await frigateManager.sendPtzCommand('my-camera', 'preset_garden');

    fakeAssert.calledWith(frigateManager.mqttClient.publish, 'frigate/my_camera/ptz', 'preset_garden');
  });

  it('should reject an invalid command', async () => {
    const promise = frigateManager.sendPtzCommand('my-camera', 'rm -rf /');

    await assert.isRejected(promise, BadParameters);
  });

  it('should reject when MQTT is not connected', async () => {
    frigateManager.mqttClient = null;

    const promise = frigateManager.sendPtzCommand('my-camera', 'MOVE_LEFT');

    await assert.isRejected(promise, ServiceNotConfiguredError);
  });

  it('should reject when Gladys is not connected to the broker', async () => {
    frigateManager.gladysConnected = false;

    const promise = frigateManager.sendPtzCommand('my-camera', 'MOVE_LEFT');

    await assert.isRejected(promise, ServiceNotConfiguredError);
  });

  it('should reject a device without external id', async () => {
    frigateManager.gladys.device.getBySelector = fake.resolves({
      selector: 'my-camera',
      params: [],
    });

    const promise = frigateManager.sendPtzCommand('my-camera', 'MOVE_LEFT');

    await assert.isRejected(promise, NotFoundError);
  });

  it('should reject a device not managed by Frigate', async () => {
    frigateManager.gladys.device.getBySelector = fake.resolves({
      selector: 'my-camera',
      external_id: 'netatmo:camera',
      params: [],
    });

    const promise = frigateManager.sendPtzCommand('my-camera', 'MOVE_LEFT');

    await assert.isRejected(promise, NotFoundError);
  });
});
