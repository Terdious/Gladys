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
    frigateManager.remoteLogin = fake.resolves(null);
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

  it('should connect to the remote instance in remote mode', async () => {
    frigateManager.getConfiguration = fake.resolves({
      frigateEnabled: true,
      mode: 'remote',
      remoteHost: '10.5.0.227',
      remotePort: '8971',
      remoteUsername: 'admin',
      remotePassword: 'secret',
      remoteMqttHost: '10.5.0.227',
      remoteMqttPort: '1885',
      remoteMqttUsername: 'frigate',
      remoteMqttPassword: 'mqtt-secret',
    });

    await frigateManager.init();

    assert.calledOnceWithExactly(frigateManager.connect, {
      mqttUrl: 'mqtt://10.5.0.227:1885',
      mqttUsername: 'frigate',
      mqttPassword: 'mqtt-secret',
    });
    expect(frigateManager.remote).to.deep.equal({
      host: '10.5.0.227',
      port: 8971,
      username: 'admin',
      password: 'secret',
    });
    assert.notCalled(frigateManager.installMqttContainer);
    assert.notCalled(frigateManager.installFrigateContainer);
    assert.notCalled(frigateManager.detectHardware);
    assert.calledOnce(frigateManager.remoteLogin);
    expect(frigateManager.mqttExist).to.equal(true);
    expect(frigateManager.mqttRunning).to.equal(true);
    expect(frigateManager.remoteConnectionError).to.equal(null);
  });

  it('should report bad credentials when the remote login is refused', async () => {
    frigateManager.getConfiguration = fake.resolves({
      frigateEnabled: true,
      mode: 'remote',
      remoteHost: '10.5.0.227',
      remoteUsername: 'admin',
      remotePassword: 'wrong',
      remoteMqttHost: '10.5.0.227',
    });
    const loginError = new Error('Request failed with status code 401');
    loginError.response = { status: 401 };
    frigateManager.remoteLogin = fake.rejects(loginError);

    try {
      await frigateManager.init();
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('FRIGATE_REMOTE_BAD_CREDENTIALS');
    }
    expect(frigateManager.remoteConnectionError).to.equal('BAD_CREDENTIALS');
    assert.notCalled(frigateManager.connect);
  });

  it('should report an unreachable remote instance', async () => {
    frigateManager.getConfiguration = fake.resolves({
      frigateEnabled: true,
      mode: 'remote',
      remoteHost: '10.6.0.99',
      remoteMqttHost: '10.6.0.99',
    });
    frigateManager.remoteLogin = fake.rejects(new Error('connect ECONNREFUSED 10.6.0.99:8971'));

    try {
      await frigateManager.init();
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('FRIGATE_REMOTE_UNREACHABLE');
    }
    expect(frigateManager.remoteConnectionError).to.equal('UNREACHABLE');
    assert.notCalled(frigateManager.connect);
  });

  it('should use the default ports when the remote ports are not set', async () => {
    frigateManager.getConfiguration = fake.resolves({
      frigateEnabled: true,
      mode: 'remote',
      remoteHost: '10.5.0.227',
      remoteUsername: 'admin',
      remotePassword: 'secret',
      remoteMqttHost: '10.5.0.227',
      remoteMqttUsername: 'frigate',
      remoteMqttPassword: 'mqtt-secret',
    });

    await frigateManager.init();

    assert.calledOnceWithExactly(frigateManager.connect, {
      mqttUrl: 'mqtt://10.5.0.227:1885',
      mqttUsername: 'frigate',
      mqttPassword: 'mqtt-secret',
    });
    expect(frigateManager.remote.port).to.equal(8971);
  });

  it('should throw when the remote MQTT host is missing', async () => {
    frigateManager.getConfiguration = fake.resolves({
      frigateEnabled: true,
      mode: 'remote',
      remoteHost: '10.5.0.227',
    });

    try {
      await frigateManager.init();
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('FRIGATE_REMOTE_NOT_CONFIGURED');
    }
  });

  it('should skip the remote connection when disabled', async () => {
    frigateManager.getConfiguration = fake.resolves({ frigateEnabled: false, mode: 'remote' });

    const result = await frigateManager.init();

    expect(result).to.equal(null);
    assert.notCalled(frigateManager.connect);
  });

  it('should throw when the remote instance is not configured', async () => {
    frigateManager.getConfiguration = fake.resolves({ frigateEnabled: true, mode: 'remote' });

    try {
      await frigateManager.init();
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('FRIGATE_REMOTE_NOT_CONFIGURED');
    }
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
