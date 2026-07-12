const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;
const proxyquire = require('proxyquire').noCallThru();

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate allocatePorts', () => {
  let FrigateManager;
  let portfinder;

  beforeEach(() => {
    portfinder = {
      getPortPromise: sinon.stub(),
    };
    portfinder.getPortPromise.callsFake(async ({ port }) => port);

    const { allocatePorts } = proxyquire('../../../../services/frigate/lib/allocatePorts', {
      portfinder,
    });
    FrigateManager = proxyquire('../../../../services/frigate/lib', {
      './allocatePorts': { allocatePorts },
    });
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should allocate all default ports when nothing is stored', async () => {
    const frigateManager = new FrigateManager({ event: { emit: fake.resolves(null) } }, null, serviceId);
    const config = {};

    await frigateManager.allocatePorts(config);

    expect(config).to.deep.equal({
      mqttPort: 1885,
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
    });
    assert.callCount(portfinder.getPortPromise, 4);
    assert.calledWithExactly(portfinder.getPortPromise, { port: 1885, stopPort: 1899 });
    assert.calledWithExactly(portfinder.getPortPromise, { port: 8971, stopPort: 8999 });
    assert.calledWithExactly(portfinder.getPortPromise, { port: 5000, stopPort: 5099 });
    assert.calledWithExactly(portfinder.getPortPromise, { port: 8554, stopPort: 8599 });
  });

  it('should increment when default port is taken', async () => {
    portfinder.getPortPromise.callsFake(async ({ port }) => port + 1);
    const frigateManager = new FrigateManager({ event: { emit: fake.resolves(null) } }, null, serviceId);
    const config = {};

    await frigateManager.allocatePorts(config);

    expect(config.mqttPort).to.equal(1886);
    expect(config.frigateUiPort).to.equal(8972);
  });

  it('should keep already allocated ports and convert them to numbers', async () => {
    const frigateManager = new FrigateManager({ event: { emit: fake.resolves(null) } }, null, serviceId);
    const config = {
      mqttPort: '1887',
      frigateUiPort: '8975',
      frigateApiPort: '5002',
      frigateRtspPort: '8556',
    };

    await frigateManager.allocatePorts(config);

    expect(config).to.deep.equal({
      mqttPort: 1887,
      frigateUiPort: 8975,
      frigateApiPort: 5002,
      frigateRtspPort: 8556,
    });
    assert.notCalled(portfinder.getPortPromise);
  });
});
