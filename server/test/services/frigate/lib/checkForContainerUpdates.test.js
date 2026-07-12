const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate checkForContainerUpdates', () => {
  let frigateManager;
  let gladys;

  beforeEach(() => {
    gladys = {
      system: {
        getContainers: fake.resolves([]),
        removeContainer: fake.resolves(true),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should do nothing when versions are up to date', async () => {
    const config = { dockerMqttVersion: '1', dockerFrigateVersion: '1' };

    await frigateManager.checkForContainerUpdates(config);

    assert.notCalled(gladys.system.getContainers);
    assert.notCalled(gladys.system.removeContainer);
  });

  it('should remove existing containers on version change', async () => {
    const config = { dockerMqttVersion: '0', dockerFrigateVersion: '0' };
    gladys.system.getContainers = fake.resolves([
      { id: 'docker-test-mqtt', name: '/gladys-frigate-mqtt' },
      { id: 'docker-test-frigate', name: '/gladys-frigate' },
    ]);

    await frigateManager.checkForContainerUpdates(config);

    assert.calledTwice(gladys.system.removeContainer);
    assert.calledWithExactly(gladys.system.removeContainer, 'docker-test-mqtt', { force: true });
    assert.calledWithExactly(gladys.system.removeContainer, 'docker-test-frigate', { force: true });
    expect(config.dockerMqttVersion).to.equal('1');
    expect(config.dockerFrigateVersion).to.equal('1');
  });

  it('should only update version when containers are absent', async () => {
    const config = {};

    await frigateManager.checkForContainerUpdates(config);

    assert.calledTwice(gladys.system.getContainers);
    assert.notCalled(gladys.system.removeContainer);
    expect(config.dockerMqttVersion).to.equal('1');
    expect(config.dockerFrigateVersion).to.equal('1');
  });
});
