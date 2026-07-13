const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate init', () => {
  let frigateManager;
  let gladys;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
      system: {
        isDocker: fake.resolves(true),
        getNetworkMode: fake.resolves('host'),
      },
    };

    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.getConfiguration = fake.resolves({ frigateEnabled: false });
    frigateManager.saveConfiguration = fake.resolves(null);
    frigateManager.checkForContainerUpdates = fake.resolves(null);
    frigateManager.installMqttContainer = fake.resolves(null);
    frigateManager.installFrigateContainer = fake.resolves(null);
    frigateManager.connect = fake.resolves(null);
    frigateManager.allocatePorts = fake(async (config) => {
      config.mqttPort = 1885;
      config.frigateUiPort = 8971;
      config.frigateApiPort = 5000;
      config.frigateRtspPort = 8554;
    });
    frigateManager.detectHardware = fake(async () => {
      frigateManager.vaapiAvailable = true;
      return true;
    });
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should not throw when not docker based and integration disabled', async () => {
    gladys.system.isDocker = fake.resolves(false);

    const result = await frigateManager.init();

    expect(result).to.equal(null);
    expect(frigateManager.dockerBased).to.equal(false);
    assert.notCalled(frigateManager.installMqttContainer);
  });

  it('should throw when not docker based and integration enabled', async () => {
    gladys.system.isDocker = fake.resolves(false);
    frigateManager.getConfiguration = fake.resolves({ frigateEnabled: true });

    try {
      await frigateManager.init();
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('SYSTEM_NOT_RUNNING_DOCKER');
    }
    assert.notCalled(frigateManager.installMqttContainer);
  });

  it('should throw when network mode is not host and integration enabled', async () => {
    gladys.system.getNetworkMode = fake.resolves('bridge');
    frigateManager.getConfiguration = fake.resolves({ frigateEnabled: true });

    try {
      await frigateManager.init();
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('DOCKER_BAD_NETWORK');
    }
    expect(frigateManager.dockerBased).to.equal(true);
    expect(frigateManager.networkModeValid).to.equal(false);
    assert.notCalled(frigateManager.installMqttContainer);
  });

  it('should skip containers installation when integration is disabled', async () => {
    const result = await frigateManager.init();

    expect(result).to.equal(null);
    expect(frigateManager.dockerBased).to.equal(true);
    expect(frigateManager.networkModeValid).to.equal(true);
    expect(frigateManager.vaapiAvailable).to.equal(true);
    assert.calledOnce(frigateManager.detectHardware);
    assert.notCalled(frigateManager.checkForContainerUpdates);
    assert.notCalled(frigateManager.installMqttContainer);
    assert.notCalled(frigateManager.installFrigateContainer);
    assert.notCalled(frigateManager.connect);
    assert.notCalled(frigateManager.saveConfiguration);
  });

  it('should generate credentials and install containers when enabled', async () => {
    frigateManager.getConfiguration = fake.resolves({ frigateEnabled: true });

    await frigateManager.init();

    assert.calledOnce(frigateManager.checkForContainerUpdates);
    assert.calledOnce(frigateManager.installMqttContainer);
    assert.calledOnce(frigateManager.installFrigateContainer);
    assert.calledOnce(frigateManager.connect);
    // Credentials/ports are saved before containers install, and again at the end
    assert.calledTwice(frigateManager.saveConfiguration);

    const savedConfig = frigateManager.saveConfiguration.firstCall.args[0];
    expect(savedConfig.mqttUsername).to.equal('gladys');
    expect(savedConfig.mqttPassword).to.have.lengthOf(20);
    expect(savedConfig.frigateMqttUsername).to.equal('frigate');
    expect(savedConfig.frigateMqttPassword).to.have.lengthOf(20);
    expect(savedConfig.mqttUrl).to.equal('mqtt://localhost:1885');
    expect(frigateManager.mqttPort).to.equal(1885);
    expect(frigateManager.frigateUiPort).to.equal(8971);
    expect(frigateManager.frigateApiPort).to.equal(5000);
    expect(frigateManager.frigateRtspPort).to.equal(8554);
  });

  it('should keep existing credentials when enabled', async () => {
    const existingConfig = {
      frigateEnabled: true,
      mqttUrl: 'mqtt://localhost:1885',
      mqttUsername: 'gladys',
      mqttPassword: 'existing-gladys-password',
      frigateMqttUsername: 'frigate',
      frigateMqttPassword: 'existing-frigate-password',
    };
    frigateManager.getConfiguration = fake.resolves(existingConfig);

    await frigateManager.init();

    const savedConfig = frigateManager.saveConfiguration.firstCall.args[0];
    expect(savedConfig.mqttPassword).to.equal('existing-gladys-password');
    expect(savedConfig.frigateMqttPassword).to.equal('existing-frigate-password');
  });
});
