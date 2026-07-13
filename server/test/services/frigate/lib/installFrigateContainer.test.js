const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const container = {
  id: 'docker-test',
  name: '/gladys-frigate',
  state: 'running',
};

const containerStopped = {
  id: 'docker-test',
  name: '/gladys-frigate',
  state: 'stopped',
};

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate installFrigateContainer', () => {
  const TEMP_GLADYS_FOLDER = process.env.TEMP_FOLDER || '../.tmp';
  let frigateManager;
  let gladys;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
      device: {
        get: fake.resolves([]),
      },
      system: {
        getContainers: fake.resolves([container]),
        stopContainer: fake.resolves(true),
        removeContainer: fake.resolves(true),
        pull: fake.resolves(true),
        restartContainer: fake.resolves(true),
        createContainer: fake.resolves(container),
        inspectContainer: fake.resolves({
          HostConfig: {
            Devices: [],
            ShmSize: 268435456,
          },
        }),
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
    frigateManager.configureContainer = fake.resolves({ configChanged: false });
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should do nothing when Frigate container is running and config unchanged', async () => {
    const config = {};

    await frigateManager.installFrigateContainer(config);

    assert.notCalled(gladys.system.restartContainer);
    assert.calledOnce(frigateManager.configureContainer);
    expect(frigateManager.frigateRunning).to.equal(true);
    expect(frigateManager.frigateExist).to.equal(true);
  });

  it('should restart Frigate container when config changed', async () => {
    const config = {};
    frigateManager.configureContainer = fake.resolves({ configChanged: true });

    await frigateManager.installFrigateContainer(config);

    assert.calledOnceWithExactly(gladys.system.restartContainer, container.id);
    expect(frigateManager.frigateRunning).to.equal(true);
  });

  it('should restart stopped Frigate container', async () => {
    const config = {};
    gladys.system.getContainers = fake.resolves([containerStopped]);

    await frigateManager.installFrigateContainer(config);

    assert.calledOnceWithExactly(gladys.system.restartContainer, container.id);
    expect(frigateManager.frigateRunning).to.equal(true);
  });

  it('should install Frigate container', async () => {
    const config = {
      frigateUiPort: 8972,
      frigateApiPort: 5001,
      frigateRtspPort: 8555,
      timezone: 'Europe/Paris',
    };
    const getContainersStub = sinon.stub();
    getContainersStub
      .onFirstCall()
      .resolves([])
      .onSecondCall()
      .resolves([containerStopped]);
    gladys.system.getContainers = getContainersStub;

    await frigateManager.installFrigateContainer(config);

    assert.calledOnce(gladys.system.pull);
    assert.calledOnce(gladys.system.createContainer);
    const descriptor = gladys.system.createContainer.firstCall.args[0];
    expect(descriptor.HostConfig.Binds).to.deep.equal([
      '/var/lib/gladysassistant/frigate/config:/config',
      '/var/lib/gladysassistant/frigate/media:/media/frigate',
    ]);
    expect(descriptor.HostConfig.ShmSize).to.equal(268435456);
    expect(descriptor.HostConfig.Tmpfs).to.deep.equal({ '/tmp/cache': 'size=1000000000' });
    expect(descriptor.HostConfig.NetworkMode).to.equal('bridge');
    expect(descriptor.HostConfig.ExtraHosts).to.deep.equal(['host.docker.internal:host-gateway']);
    expect(descriptor.HostConfig.PortBindings).to.deep.equal({
      '8971/tcp': [{ HostPort: '8972' }],
      '5000/tcp': [{ HostIp: '127.0.0.1', HostPort: '5001' }],
      '8554/tcp': [{ HostIp: '127.0.0.1', HostPort: '8555' }],
    });
    expect(descriptor.Env).to.deep.equal(['TZ=Europe/Paris']);
    assert.calledOnceWithExactly(gladys.system.restartContainer, container.id);
    expect(frigateManager.frigateRunning).to.equal(true);
    expect(frigateManager.frigateExist).to.equal(true);
  });

  it('should install Frigate container without timezone', async () => {
    const config = {
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
    };
    const getContainersStub = sinon.stub();
    getContainersStub
      .onFirstCall()
      .resolves([])
      .onSecondCall()
      .resolves([container]);
    gladys.system.getContainers = getContainersStub;

    await frigateManager.installFrigateContainer(config);

    const descriptor = gladys.system.createContainer.firstCall.args[0];
    expect(descriptor.Env).to.deep.equal([]);
    expect(frigateManager.frigateRunning).to.equal(true);
  });

  it('should fail to install Frigate container', async () => {
    const config = {};
    gladys.system.getContainers = fake.resolves([]);
    gladys.system.pull = fake.throws(new Error('docker fail pull'));

    try {
      await frigateManager.installFrigateContainer(config);
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('docker fail pull');
    }
    expect(frigateManager.frigateRunning).to.equal(false);
    expect(frigateManager.frigateExist).to.equal(false);
  });

  it('should fail to start Frigate container', async () => {
    const config = {};
    gladys.system.getContainers = fake.resolves([containerStopped]);
    gladys.system.restartContainer = fake.throws(new Error('docker fail restart'));

    try {
      await frigateManager.installFrigateContainer(config);
      assert.fail();
    } catch (e) {
      expect(e.message).to.equal('docker fail restart');
    }
    expect(frigateManager.frigateRunning).to.equal(false);
    expect(frigateManager.frigateExist).to.equal(true);
  });

  it('should recreate the container when the GPU becomes available', async () => {
    const config = {
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
    };
    frigateManager.vaapiAvailable = true;

    await frigateManager.installFrigateContainer(config);

    assert.calledOnce(gladys.system.stopContainer);
    assert.calledOnce(gladys.system.removeContainer);
    assert.calledOnce(gladys.system.createContainer);
    const descriptor = gladys.system.createContainer.firstCall.args[0];
    expect(descriptor.HostConfig.Devices).to.deep.equal([
      {
        PathOnHost: '/dev/dri/renderD128',
        PathInContainer: '/dev/dri/renderD128',
        CgroupPermissions: 'rwm',
      },
    ]);
  });

  it('should expose the USB Coral to the container', async () => {
    const config = {
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
    };
    frigateManager.coralAvailable = true;
    frigateManager.coralDeviceType = 'usb';

    await frigateManager.installFrigateContainer(config);

    assert.calledOnce(gladys.system.removeContainer);
    const descriptor = gladys.system.createContainer.firstCall.args[0];
    expect(descriptor.HostConfig.Devices).to.deep.equal([
      {
        PathOnHost: '/dev/bus/usb',
        PathInContainer: '/dev/bus/usb',
        CgroupPermissions: 'rwm',
      },
    ]);
  });

  it('should expose the PCIe Coral to the container', async () => {
    const config = {
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
    };
    frigateManager.coralAvailable = true;
    frigateManager.coralDeviceType = 'pcie';

    await frigateManager.installFrigateContainer(config);

    const descriptor = gladys.system.createContainer.firstCall.args[0];
    expect(descriptor.HostConfig.Devices).to.deep.equal([
      {
        PathOnHost: '/dev/apex_0',
        PathInContainer: '/dev/apex_0',
        CgroupPermissions: 'rwm',
      },
    ]);
  });

  it('should recreate the container when the shm size changed', async () => {
    const config = {
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
    };
    // 2 cameras: shm must grow beyond the base size
    gladys.device.get = fake.resolves([{ external_id: 'frigate:a' }, { external_id: 'frigate:b' }]);

    await frigateManager.installFrigateContainer(config);

    assert.calledOnce(gladys.system.removeContainer);
    const descriptor = gladys.system.createContainer.firstCall.args[0];
    expect(descriptor.HostConfig.ShmSize).to.equal(268435456 + 67108864);
  });

  it('should not recreate the container when hardware settings are unchanged', async () => {
    const config = {};

    await frigateManager.installFrigateContainer(config);

    assert.notCalled(gladys.system.removeContainer);
    assert.notCalled(gladys.system.createContainer);
  });

  it('should treat missing inspected devices as an empty list', async () => {
    const config = {};
    gladys.system.inspectContainer = fake.resolves({
      HostConfig: {
        ShmSize: 268435456,
      },
    });

    await frigateManager.installFrigateContainer(config);

    assert.notCalled(gladys.system.removeContainer);
  });
});
