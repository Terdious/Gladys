const { expect } = require('chai');
const sinon = require('sinon');
const { promises: fs } = require('fs');
const path = require('path');

const { fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate getRetentionSettings', () => {
  const TEMP_GLADYS_FOLDER = path.join(process.env.TEMP_FOLDER || '../.tmp', 'frigate-retention-test');
  const configFilePath = path.join(TEMP_GLADYS_FOLDER, 'frigate/config/config.yml');
  let frigateManager;
  let variables;

  beforeEach(async () => {
    variables = {};
    const gladys = {
      system: {
        getGladysBasePath: fake.resolves({
          basePathOnHost: '/var/lib/gladysassistant',
          basePathOnContainer: TEMP_GLADYS_FOLDER,
        }),
      },
      variable: {
        getValue: fake((key) => Promise.resolve(variables[key] || null)),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    await fs.rm(TEMP_GLADYS_FOLDER, { recursive: true, force: true });
  });

  it('should return the retention read from the configuration file', async () => {
    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    const existingConfig = [
      'cameras:',
      '  c660:',
      '    record:',
      '      enabled: true',
      '      continuous:',
      '        days: 30',
      '      alerts:',
      '        retain:',
      '          days: 60',
      '      detections:',
      '        retain:',
      '          days: 45',
      '',
    ].join('\n');
    await fs.writeFile(configFilePath, existingConfig);
    // Gladys variables differ: the file is what Frigate actually applies
    variables.FRIGATE_RECORD_CONTINUOUS_DAYS = '2';

    const retention = await frigateManager.getRetentionSettings();

    expect(retention).to.deep.equal({ continuous: 30, alerts: 60, detections: 45 });
  });

  it('should fall back to the Gladys variables when the file has no retention', async () => {
    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    await fs.writeFile(configFilePath, 'cameras: {}\n');
    variables.FRIGATE_RECORD_CONTINUOUS_DAYS = '10';
    variables.FRIGATE_RECORD_ALERTS_DAYS = '30';
    variables.FRIGATE_RECORD_DETECTIONS_DAYS = '14';

    const retention = await frigateManager.getRetentionSettings();

    expect(retention).to.deep.equal({ continuous: 10, alerts: 30, detections: 14 });
  });

  it('should fall back to the defaults when nothing is stored', async () => {
    const retention = await frigateManager.getRetentionSettings();

    expect(retention).to.deep.equal({ continuous: 2, alerts: 7, detections: 7 });
  });

  it('should ignore invalid values found in the file', async () => {
    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    const existingConfig = [
      'cameras:',
      '  c660:',
      '    record:',
      '      enabled: true',
      '      continuous:',
      '        days: not-a-number',
      '',
    ].join('\n');
    await fs.writeFile(configFilePath, existingConfig);
    variables.FRIGATE_RECORD_CONTINUOUS_DAYS = '5';

    const retention = await frigateManager.getRetentionSettings();

    expect(retention).to.deep.equal({ continuous: 5, alerts: 7, detections: 7 });
  });

  it('should handle an empty configuration file', async () => {
    await fs.mkdir(path.dirname(configFilePath), { recursive: true });
    await fs.writeFile(configFilePath, '');

    const retention = await frigateManager.getRetentionSettings();

    expect(retention).to.deep.equal({ continuous: 2, alerts: 7, detections: 7 });
  });
});
