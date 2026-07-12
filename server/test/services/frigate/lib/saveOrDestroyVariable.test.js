const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate saveOrDestroyVariable', () => {
  let gladys;
  let frigateManager;

  beforeEach(() => {
    gladys = {
      variable: {
        setValue: fake.resolves(null),
        destroy: fake.resolves(null),
      },
    };
    frigateManager = new FrigateManager(gladys, null, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should save variable', async () => {
    await frigateManager.saveOrDestroyVariable('KEY', 'value');
    assert.calledOnceWithExactly(gladys.variable.setValue, 'KEY', 'value', serviceId);
    assert.notCalled(gladys.variable.destroy);
  });

  it('should destroy variable on null value', async () => {
    await frigateManager.saveOrDestroyVariable('KEY', null);
    assert.calledOnceWithExactly(gladys.variable.destroy, 'KEY', serviceId);
    assert.notCalled(gladys.variable.setValue);
  });

  it('should destroy variable on undefined value', async () => {
    await frigateManager.saveOrDestroyVariable('KEY', undefined);
    assert.calledOnceWithExactly(gladys.variable.destroy, 'KEY', serviceId);
    assert.notCalled(gladys.variable.setValue);
  });
});
