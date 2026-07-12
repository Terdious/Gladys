const { expect } = require('chai');
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

  beforeEach(async () => {
    frigateManager = new FrigateManager({}, null, serviceId);
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
