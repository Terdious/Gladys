const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate setEnabled', () => {
  let gladys;
  let frigateManager;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
      variable: {
        setValue: fake.resolves(null),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should enable the integration', async () => {
    await frigateManager.setEnabled(true);
    expect(frigateManager.frigateEnabled).to.equal(true);
    assert.calledOnceWithExactly(gladys.variable.setValue, 'FRIGATE_ENABLED', '1', serviceId);
    assert.calledOnce(gladys.event.emit);
  });

  it('should disable the integration', async () => {
    frigateManager.frigateEnabled = true;
    await frigateManager.setEnabled(false);
    expect(frigateManager.frigateEnabled).to.equal(false);
    assert.calledOnceWithExactly(gladys.variable.setValue, 'FRIGATE_ENABLED', '0', serviceId);
    assert.calledOnce(gladys.event.emit);
  });
});
