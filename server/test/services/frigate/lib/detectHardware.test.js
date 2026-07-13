const { expect } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate detectHardware', () => {
  afterEach(() => {
    sinon.reset();
  });

  const buildManager = (accessStub) => {
    const { detectHardware } = proxyquire('../../../../services/frigate/lib/detectHardware', {
      'fs/promises': { access: accessStub },
    });
    const FrigateManager = proxyquire('../../../../services/frigate/lib', {
      './detectHardware': { detectHardware },
    });
    return new FrigateManager({}, null, serviceId);
  };

  it('should detect the render node', async () => {
    const access = sinon.stub().resolves();
    const frigateManager = buildManager(access);

    const vaapiAvailable = await frigateManager.detectHardware();

    expect(vaapiAvailable).to.equal(true);
    expect(access.firstCall.args[0]).to.equal('/dev/dri/renderD128');
  });

  it('should fallback to CPU when no render node', async () => {
    const access = sinon.stub().rejects(new Error('ENOENT'));
    const frigateManager = buildManager(access);

    const vaapiAvailable = await frigateManager.detectHardware();

    expect(vaapiAvailable).to.equal(false);
  });
});
