const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate disconnect', () => {
  it('should only close the MQTT connection in remote mode', async () => {
    const gladysRemote = {
      event: { emit: fake.resolves(null) },
      system: {
        getContainers: fake.resolves([]),
        stopContainer: fake.resolves(true),
        removeContainer: fake.resolves(true),
      },
    };
    const manager = new FrigateManager(gladysRemote, null, serviceId);
    manager.mode = 'remote';
    manager.mqttClient = { end: fake.returns(null), removeAllListeners: fake.returns(null) };

    await manager.disconnect();

    assert.notCalled(gladysRemote.system.getContainers);
    assert.notCalled(gladysRemote.system.stopContainer);
  });

  let frigateManager;
  let gladys;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
      system: {
        getContainers: fake.resolves([
          { id: 'docker-test-mqtt', name: '/gladys-frigate-mqtt', state: 'running' },
          { id: 'docker-test-frigate', name: '/gladys-frigate', state: 'running' },
        ]),
        stopContainer: fake.resolves(true),
        removeContainer: fake.resolves(true),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should disconnect mqtt client and remove containers', async () => {
    const mqttClient = {
      end: fake.returns(null),
      removeAllListeners: fake.returns(null),
    };
    frigateManager.mqttClient = mqttClient;
    frigateManager.gladysConnected = true;
    frigateManager.mqttRunning = true;
    frigateManager.frigateRunning = true;
    frigateManager.frigateConnected = true;
    frigateManager.stats = { service: {} };

    await frigateManager.disconnect();

    assert.calledOnce(mqttClient.end);
    assert.calledOnce(mqttClient.removeAllListeners);
    expect(frigateManager.mqttClient).to.equal(null);
    assert.calledTwice(gladys.system.stopContainer);
    assert.calledTwice(gladys.system.removeContainer);
    expect(frigateManager.gladysConnected).to.equal(false);
    expect(frigateManager.mqttRunning).to.equal(false);
    expect(frigateManager.frigateRunning).to.equal(false);
    expect(frigateManager.frigateConnected).to.equal(false);
    expect(frigateManager.stats).to.equal(null);
  });

  it('should do nothing when not connected and containers absent', async () => {
    gladys.system.getContainers = fake.resolves([]);

    await frigateManager.disconnect();

    assert.notCalled(gladys.system.stopContainer);
    assert.notCalled(gladys.system.removeContainer);
    expect(frigateManager.gladysConnected).to.equal(false);
  });
});
