const { expect } = require('chai');
const sinon = require('sinon');
const { promises: fs } = require('fs');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const container = {
  id: 'docker-test',
  state: 'running',
};

const containerStopped = {
  id: 'docker-test',
  state: 'stopped',
};

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate installMqttContainer', () => {
  const TEMP_GLADYS_FOLDER = process.env.TEMP_FOLDER || '../.tmp';
  let frigateManager;
  let gladys;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
      system: {
        getContainers: fake.resolves([containerStopped]),
        stopContainer: fake.resolves(true),
        pull: fake.resolves(true),
        restartContainer: fake.resolves(true),
        createContainer: fake.resolves(container),
        exec: fake.resolves(true),
        getGladysBasePath: fake.resolves({
          basePathOnHost: '/var/lib/gladysassistant',
          basePathOnContainer: TEMP_GLADYS_FOLDER,
        }),
      },
    };

    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.dockerBased = true;
    frigateManager.networkModeValid = true;
    frigateManager.containerRestartWaitTimeInMs = 0;
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should restart existing stopped MQTT container', async () => {
    const config = {};

    await frigateManager.installMqttContainer(config);

    assert.calledOnceWithExactly(gladys.system.restartContainer, container.id);
    expect(frigateManager.mqttRunning).to.equal(true);
    expect(frigateManager.mqttExist).to.equal(true);
  });

  it('should do nothing when MQTT container already running', async () => {
    const config = {};
    gladys.system.getContainers = fake.resolves([container]);

    await frigateManager.installMqttContainer(config);

    assert.notCalled(gladys.system.restartContainer);
    expect(frigateManager.mqttRunning).to.equal(true);
    expect(frigateManager.mqttExist).to.equal(true);
  });

  it('should fail to start existing MQTT container', async () => {
    const config = {};
    gladys.system.restartContainer = fake.throws(new Error('docker fail'));

    try {
      await frigateManager.installMqttContainer(config);
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('docker fail');
    }
    expect(frigateManager.mqttRunning).to.equal(false);
    expect(frigateManager.mqttExist).to.equal(true);
  });

  it('should fail to install MQTT container', async () => {
    const config = {};
    gladys.system.getContainers = fake.resolves([]);
    gladys.system.pull = fake.throws(new Error('docker fail pull'));

    try {
      await frigateManager.installMqttContainer(config);
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('docker fail pull');
    }
    expect(frigateManager.mqttRunning).to.equal(false);
    expect(frigateManager.mqttExist).to.equal(false);
  });

  it('should install MQTT container and configure users', async () => {
    const config = {
      mqttUsername: 'gladys',
      mqttPassword: 'gladys-password',
      frigateMqttUsername: 'frigate',
      frigateMqttPassword: 'frigate-password',
      mqttPort: 1886,
    };
    gladys.system.getContainers = fake.resolves([]);

    await frigateManager.installMqttContainer(config);

    assert.calledOnce(gladys.system.pull);
    assert.calledOnce(gladys.system.createContainer);
    const descriptor = gladys.system.createContainer.firstCall.args[0];
    expect(descriptor.HostConfig.Binds).to.deep.equal(['/var/lib/gladysassistant/frigate/mqtt:/mosquitto/config']);
    expect(descriptor.ExposedPorts).to.deep.equal({ '1886/tcp': {} });
    expect(descriptor.HostConfig.PortBindings).to.deep.equal({ '1886/tcp': [{ HostPort: '1886' }] });
    assert.calledTwice(gladys.system.restartContainer);
    assert.calledTwice(gladys.system.exec);
    assert.calledWithExactly(gladys.system.exec, container.id, {
      Cmd: ['mosquitto_passwd', '-b', '/mosquitto/config/mosquitto.passwd', 'frigate', 'frigate-password'],
    });
    assert.calledWithExactly(gladys.system.exec, container.id, {
      Cmd: ['mosquitto_passwd', '-b', '/mosquitto/config/mosquitto.passwd', 'gladys', 'gladys-password'],
    });
    expect(frigateManager.mqttRunning).to.equal(true);
    expect(frigateManager.mqttExist).to.equal(true);

    const mosquittoConfPath = `${TEMP_GLADYS_FOLDER}/frigate/mqtt/mosquitto.conf`;
    const mosquittoConfContent = await fs.readFile(mosquittoConfPath, 'utf-8');
    expect(mosquittoConfContent).to.contain('listener 1886');
    expect(mosquittoConfContent).to.not.contain('listener 1885');
    expect(mosquittoConfContent).to.contain('allow_anonymous false');
    expect(mosquittoConfContent).to.contain('password_file /mosquitto/config/mosquitto.passwd');
    const mosquittoPwdPath = `${TEMP_GLADYS_FOLDER}/frigate/mqtt/mosquitto.passwd`;
    const mosquittoPwdContent = await fs.readFile(mosquittoPwdPath, 'utf-8');
    expect(mosquittoPwdContent).to.equal('');
  });

  it('should fail to configure MQTT container users', async () => {
    const config = {
      mqttUsername: 'gladys',
      mqttPassword: 'gladys-password',
      frigateMqttUsername: 'frigate',
      frigateMqttPassword: 'frigate-password',
      mqttPort: 1885,
    };
    gladys.system.getContainers = fake.resolves([]);
    gladys.system.restartContainer = fake.throws(new Error('docker fail restart'));

    try {
      await frigateManager.installMqttContainer(config);
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('docker fail restart');
    }
    assert.calledOnce(gladys.system.createContainer);
    expect(frigateManager.mqttRunning).to.equal(false);
    expect(frigateManager.mqttExist).to.equal(true);
  });
});
