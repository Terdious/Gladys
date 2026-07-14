const sinon = require('sinon');
const { expect } = require('chai');

const { fake, assert } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate writeConfig', () => {
  let frigateManager;
  let gladys;

  beforeEach(() => {
    gladys = {
      system: {
        getGladysBasePath: fake.resolves({
          basePathOnContainer: '/var/lib/gladysassistant',
          basePathOnHost: '/gladys',
        }),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
    frigateManager.frigateEnabled = true;
    frigateManager.getConfiguration = fake.resolves({ mqttPort: 1885 });
    frigateManager.configureContainer = fake.resolves({ configChanged: true });
    frigateManager.emitStatusEvent = fake.returns(null);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should write the config and flag a pending restart when it changed', async () => {
    const result = await frigateManager.writeConfig();

    assert.calledWith(frigateManager.configureContainer, '/var/lib/gladysassistant', { mqttPort: 1885 });
    assert.calledOnce(frigateManager.emitStatusEvent);
    expect(frigateManager.configPendingRestart).to.equal(true);
    expect(result).to.deep.equal({ configChanged: true, configPendingRestart: true });
  });

  it('should not flag a pending restart when the config did not change', async () => {
    frigateManager.configureContainer = fake.resolves({ configChanged: false });

    const result = await frigateManager.writeConfig();

    assert.notCalled(frigateManager.emitStatusEvent);
    expect(frigateManager.configPendingRestart).to.equal(false);
    expect(result).to.deep.equal({ configChanged: false, configPendingRestart: false });
  });

  it('should keep the pending restart flag across unchanged saves', async () => {
    frigateManager.configPendingRestart = true;
    frigateManager.configureContainer = fake.resolves({ configChanged: false });

    const result = await frigateManager.writeConfig();

    expect(result).to.deep.equal({ configChanged: false, configPendingRestart: true });
  });

  it('should do nothing when the integration is disabled', async () => {
    frigateManager.frigateEnabled = false;

    const result = await frigateManager.writeConfig();

    assert.notCalled(frigateManager.configureContainer);
    expect(result).to.deep.equal({ configChanged: false, configPendingRestart: false });
  });
});
