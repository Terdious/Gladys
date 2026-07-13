const { expect } = require('chai');
const sinon = require('sinon');
const { promises: fs } = require('fs');
const path = require('path');

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate configureContainer', () => {
  const TEMP_GLADYS_FOLDER = path.join(process.env.TEMP_FOLDER || '../.tmp', 'frigate-configure-test');
  const configFilePath = path.join(TEMP_GLADYS_FOLDER, 'frigate/config/config.yml');
  let frigateManager;

  const config = {
    frigateMqttUsername: 'frigate',
    frigateMqttPassword: 'frigate-password',
    mqttPort: 1885,
  };

  let gladys;

  beforeEach(async () => {
    gladys = {
      device: {
        get: sinon.fake.resolves([]),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    await fs.rm(TEMP_GLADYS_FOLDER, { recursive: true, force: true });
  });

  it('should create default configuration file', async () => {
    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    expect(configChanged).to.equal(true);
    const fileContent = (await fs.readFile(configFilePath)).toString();
    expect(fileContent).to.contain('enabled: true');
    expect(fileContent).to.contain('host.docker.internal');
    expect(fileContent).to.contain('port: 1885');
    expect(fileContent).to.contain('user: frigate');
    expect(fileContent).to.contain('password: frigate-password');
    expect(fileContent).to.contain('cameras: {}');
  });

  it('should not rewrite unchanged configuration', async () => {
    await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    expect(configChanged).to.equal(false);
  });

  it('should update configuration when credentials changed', async () => {
    await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, {
      frigateMqttUsername: 'frigate',
      frigateMqttPassword: 'new-password',
      mqttPort: 1885,
    });

    expect(configChanged).to.equal(true);
    const fileContent = (await fs.readFile(configFilePath)).toString();
    expect(fileContent).to.contain('password: new-password');
  });

  it('should generate go2rtc and cameras sections from Gladys devices', async () => {
    gladys.device.get = sinon.fake.resolves([
      {
        external_id: 'frigate:c660',
        params: [
          { name: 'FRIGATE_SOURCE_TYPE', value: 'tapo' },
          { name: 'FRIGATE_SOURCE_HOST', value: '10.6.0.222' },
          { name: 'FRIGATE_SOURCE_PASSWORD', value: 'password' },
          { name: 'FRIGATE_TRACKED_LABELS', value: 'person,dog' },
        ],
      },
      {
        // invalid device, should be skipped without failing
        external_id: 'frigate:broken',
        params: [{ name: 'FRIGATE_SOURCE_TYPE', value: 'rtsp' }],
      },
    ]);

    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    expect(configChanged).to.equal(true);
    const fileContent = (await fs.readFile(configFilePath)).toString();
    expect(fileContent).to.contain('go2rtc:');
    expect(fileContent).to.contain('tapo://password@10.6.0.222?channel=0&subtype=1');
    expect(fileContent).to.contain('rtsp://127.0.0.1:8554/c660');
    expect(fileContent).to.contain('use_wallclock_as_timestamps');
    expect(fileContent).to.contain('- person');
    expect(fileContent).to.contain('- dog');
    expect(fileContent).to.not.contain('broken');

    // Re-run with same devices: no change
    const secondRun = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);
    expect(secondRun.configChanged).to.equal(false);
  });

  it('should preserve zones, masks and object filters configured through the Frigate UI', async () => {
    gladys.device.get = sinon.fake.resolves([
      {
        external_id: 'frigate:c660',
        params: [
          { name: 'FRIGATE_SOURCE_TYPE', value: 'rtsp' },
          { name: 'FRIGATE_SOURCE_HOST', value: '192.168.1.10' },
          { name: 'FRIGATE_TRACKED_LABELS', value: 'person' },
        ],
      },
    ]);
    // Simulate zones/masks/filters previously added through the Frigate UI
    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    const existingConfig = [
      'cameras:',
      '  c660:',
      '    zones:',
      '      zone_chatiere:',
      "        coordinates: '0.296,0.144,0.835,0.156'",
      '    motion:',
      "      mask: '0,0,0.5,0.5'",
      '    objects:',
      '      filters:',
      '        person:',
      '          threshold: 0.8',
      '',
    ].join('\n');
    await fs.writeFile(configFilePath, existingConfig);

    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    expect(configChanged).to.equal(true);
    const fileContent = (await fs.readFile(configFilePath)).toString();
    expect(fileContent).to.contain('zone_chatiere');
    expect(fileContent).to.contain('0,0,0.5,0.5');
    expect(fileContent).to.contain('threshold: 0.8');
    expect(fileContent).to.contain('- person');
    expect(fileContent).to.contain('rtsp://127.0.0.1:8554/c660');
  });

  it('should remove go2rtc and cameras when devices are deleted', async () => {
    gladys.device.get = sinon.fake.resolves([
      {
        external_id: 'frigate:c660',
        params: [
          { name: 'FRIGATE_SOURCE_TYPE', value: 'rtsp' },
          { name: 'FRIGATE_SOURCE_HOST', value: '192.168.1.10' },
        ],
      },
    ]);
    await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    gladys.device.get = sinon.fake.resolves([]);
    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    expect(configChanged).to.equal(true);
    const fileContent = (await fs.readFile(configFilePath)).toString();
    expect(fileContent).to.not.contain('go2rtc:');
    expect(fileContent).to.contain('cameras: {}');
  });

  it('should handle an empty existing configuration file', async () => {
    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    await fs.writeFile(configFilePath, '');

    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    expect(configChanged).to.equal(true);
    const fileContent = (await fs.readFile(configFilePath)).toString();
    expect(fileContent).to.contain('user: frigate');
    expect(fileContent).to.contain('cameras: {}');
  });

  it('should add missing mqtt section to existing config', async () => {
    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    await fs.writeFile(configFilePath, 'cameras: {}\n');

    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    expect(configChanged).to.equal(true);
    const fileContent = (await fs.readFile(configFilePath)).toString();
    expect(fileContent).to.contain('user: frigate');
    expect(fileContent).to.contain('password: frigate-password');
  });

  it('should add missing cameras section and preserve existing config', async () => {
    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    const existingConfig = [
      'mqtt:',
      '  enabled: true',
      '  host: host.docker.internal',
      '  port: 1885',
      '  user: frigate',
      '  password: frigate-password',
      'detectors:',
      '  cpu1:',
      '    type: cpu',
      '',
    ].join('\n');
    await fs.writeFile(configFilePath, existingConfig);

    const { configChanged } = await frigateManager.configureContainer(TEMP_GLADYS_FOLDER, config);

    expect(configChanged).to.equal(true);
    const fileContent = (await fs.readFile(configFilePath)).toString();
    expect(fileContent).to.contain('cameras: {}');
    expect(fileContent).to.contain('type: cpu');
  });
});
