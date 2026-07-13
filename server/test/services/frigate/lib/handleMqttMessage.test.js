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
      stateManager: {
        get: fake.returns(null),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.configureAdminUser = fake.resolves(null);
    frigateManager.updateCameraImage = fake.resolves(null);
    frigateManager.updateLabelImage = fake.resolves(null);
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

  it('should emit a new state and refresh the image on label detection start', async () => {
    gladys.stateManager.get = fake.returns({ external_id: 'frigate:c660:person' });

    await frigateManager.handleMqttMessage('frigate/c660/person', '1');

    assert.calledOnceWithExactly(gladys.stateManager.get, 'deviceFeatureByExternalId', 'frigate:c660:person');
    assert.calledOnceWithExactly(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'frigate:c660:person',
      state: 1,
    });
    assert.calledOnceWithExactly(frigateManager.updateCameraImage, 'c660');
  });

  it('should normalize the object count to a binary state', async () => {
    gladys.stateManager.get = fake.returns({ external_id: 'frigate:c660:person' });

    await frigateManager.handleMqttMessage('frigate/c660/person', '2');

    assert.calledOnceWithExactly(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'frigate:c660:person',
      state: 1,
    });
    assert.calledOnceWithExactly(frigateManager.updateCameraImage, 'c660');
  });

  it('should emit a new state without refreshing the image on label detection end', async () => {
    gladys.stateManager.get = fake.returns({ external_id: 'frigate:c660:person' });

    await frigateManager.handleMqttMessage('frigate/c660/person', '0');

    assert.calledOnceWithExactly(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'frigate:c660:person',
      state: 0,
    });
    assert.notCalled(frigateManager.updateCameraImage);
  });

  it('should ignore label topics of unknown features', async () => {
    await frigateManager.handleMqttMessage('frigate/unknown/person', '1');

    assert.notCalled(gladys.event.emit);
    assert.notCalled(frigateManager.updateCameraImage);
  });

  it('should ignore label topics with non numeric payload', async () => {
    gladys.stateManager.get = fake.returns({ external_id: 'frigate:c660:person' });

    await frigateManager.handleMqttMessage('frigate/c660/person', 'not-a-number');

    assert.notCalled(gladys.event.emit);
  });

  it('should handle binary payloads without breaking the string topics', async () => {
    await frigateManager.handleMqttMessage('frigate/available', Buffer.from('online'));

    expect(frigateManager.frigateConnected).to.equal(true);
  });

  it('should store the label snapshot in its image feature', async () => {
    const imageBuffer = Buffer.from('jpeg-data');

    await frigateManager.handleMqttMessage('frigate/c660/person/snapshot', imageBuffer);

    assert.calledOnceWithExactly(frigateManager.updateLabelImage, 'c660', 'person', imageBuffer);
    assert.notCalled(gladys.event.emit);
  });

  it('should ignore unhandled topics', async () => {
    await frigateManager.handleMqttMessage('frigate/events/some/other/topic', 'message');
    expect(frigateManager.stats).to.equal(null);
    assert.notCalled(gladys.event.emit);
  });
});
