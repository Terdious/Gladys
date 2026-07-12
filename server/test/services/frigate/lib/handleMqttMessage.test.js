const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate handleMqttMessage', () => {
  let gladys;
  let frigateManager;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.configureAdminUser = fake.resolves(null);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should set frigate as connected on available online and configure admin user', async () => {
    await frigateManager.handleMqttMessage('frigate/available', 'online');
    expect(frigateManager.frigateConnected).to.equal(true);
    assert.calledOnce(gladys.event.emit);
    assert.calledOnce(frigateManager.configureAdminUser);
  });

  it('should set frigate as disconnected on available offline', async () => {
    frigateManager.frigateConnected = true;
    await frigateManager.handleMqttMessage('frigate/available', 'offline');
    expect(frigateManager.frigateConnected).to.equal(false);
    assert.calledOnce(gladys.event.emit);
    assert.notCalled(frigateManager.configureAdminUser);
  });

  it('should store parsed stats and retry admin configuration', async () => {
    await frigateManager.handleMqttMessage('frigate/stats', '{"service":{"version":"0.17.2"}}');
    expect(frigateManager.stats).to.deep.equal({ service: { version: '0.17.2' } });
    assert.calledOnce(frigateManager.configureAdminUser);
  });

  it('should not retry admin configuration on stats when already configured', async () => {
    frigateManager.adminConfigured = true;
    await frigateManager.handleMqttMessage('frigate/stats', '{"service":{"version":"0.17.2"}}');
    assert.notCalled(frigateManager.configureAdminUser);
  });

  it('should not crash on invalid stats payload', async () => {
    await frigateManager.handleMqttMessage('frigate/stats', 'not-json');
    expect(frigateManager.stats).to.equal(null);
  });

  it('should ignore unhandled topics', async () => {
    await frigateManager.handleMqttMessage('frigate/some/other/topic', 'message');
    expect(frigateManager.stats).to.equal(null);
    assert.notCalled(gladys.event.emit);
  });
});
