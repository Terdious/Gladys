const sinon = require('sinon');
const { expect } = require('chai');

const { fake, assert } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate restartFrigate', () => {
  let frigateManager;

  beforeEach(() => {
    frigateManager = new FrigateManager({}, null, serviceId);
    frigateManager.configPendingRestart = true;
    frigateManager.emitStatusEvent = fake.returns(null);
    frigateManager.init = fake.resolves(null);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should restart Frigate through MQTT when connected', async () => {
    frigateManager.frigateConnected = true;
    frigateManager.mqttClient = {
      publish: fake.returns(null),
    };

    await frigateManager.restartFrigate();

    assert.calledWith(frigateManager.mqttClient.publish, 'frigate/restart', 'restart');
    assert.notCalled(frigateManager.init);
    expect(frigateManager.configPendingRestart).to.equal(false);
    assert.calledOnce(frigateManager.emitStatusEvent);
  });

  it('should run the full init when Frigate is not reachable through MQTT', async () => {
    frigateManager.frigateConnected = false;

    await frigateManager.restartFrigate();

    assert.calledOnce(frigateManager.init);
    expect(frigateManager.configPendingRestart).to.equal(false);
    assert.calledOnce(frigateManager.emitStatusEvent);
  });

  it('should keep the pending restart flag when the init fails', async () => {
    frigateManager.frigateConnected = false;
    frigateManager.init = fake.rejects(new Error('SYSTEM_NOT_RUNNING_DOCKER'));

    await frigateManager.restartFrigate().catch(() => null);

    expect(frigateManager.configPendingRestart).to.equal(true);
    assert.notCalled(frigateManager.emitStatusEvent);
  });
});
