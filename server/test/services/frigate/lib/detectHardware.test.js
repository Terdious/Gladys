const { expect } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate detectHardware', () => {
  afterEach(() => {
    sinon.reset();
  });

  const buildManager = (fsStubs) => {
    const { detectHardware } = proxyquire('../../../../services/frigate/lib/detectHardware', {
      'fs/promises': fsStubs,
    });
    const FrigateManager = proxyquire('../../../../services/frigate/lib', {
      './detectHardware': { detectHardware },
    });
    return new FrigateManager({}, null, serviceId);
  };

  it('should detect the render node and no Coral', async () => {
    const access = sinon.stub();
    access.withArgs('/dev/dri/renderD128').resolves();
    access.withArgs('/dev/apex_0').rejects(new Error('ENOENT'));
    const readdir = sinon.stub().rejects(new Error('ENOENT'));
    const frigateManager = buildManager({ access, readdir });

    const vaapiAvailable = await frigateManager.detectHardware();

    expect(vaapiAvailable).to.equal(true);
    expect(frigateManager.vaapiAvailable).to.equal(true);
    expect(frigateManager.coralAvailable).to.equal(false);
    expect(frigateManager.coralDeviceType).to.equal(null);
  });

  it('should fallback to CPU when no hardware at all', async () => {
    const access = sinon.stub().rejects(new Error('ENOENT'));
    const readdir = sinon.stub().resolves([]);
    const frigateManager = buildManager({ access, readdir });

    const vaapiAvailable = await frigateManager.detectHardware();

    expect(vaapiAvailable).to.equal(false);
    expect(frigateManager.vaapiAvailable).to.equal(false);
    expect(frigateManager.coralAvailable).to.equal(false);
  });

  it('should detect a PCIe Coral', async () => {
    const access = sinon.stub();
    access.withArgs('/dev/dri/renderD128').rejects(new Error('ENOENT'));
    access.withArgs('/dev/apex_0').resolves();
    const frigateManager = buildManager({ access, readdir: sinon.stub().resolves([]) });

    await frigateManager.detectHardware();

    expect(frigateManager.coralAvailable).to.equal(true);
    expect(frigateManager.coralDeviceType).to.equal('pcie');
  });

  it('should detect a USB Coral through its vendor id', async () => {
    const access = sinon.stub().rejects(new Error('ENOENT'));
    const readdir = sinon.stub().resolves(['1-1', '1-2', 'usb1']);
    const readFile = sinon.stub();
    readFile.withArgs('/sys/bus/usb/devices/1-1/idVendor').resolves(Buffer.from('1d6b\n'));
    readFile.withArgs('/sys/bus/usb/devices/1-2/idVendor').resolves(Buffer.from('1a6e\n'));
    readFile.withArgs('/sys/bus/usb/devices/usb1/idVendor').rejects(new Error('ENOENT'));
    const frigateManager = buildManager({ access, readdir, readFile });

    await frigateManager.detectHardware();

    expect(frigateManager.coralAvailable).to.equal(true);
    expect(frigateManager.coralDeviceType).to.equal('usb');
  });

  it('should not detect a Coral when no USB device matches', async () => {
    const access = sinon.stub().rejects(new Error('ENOENT'));
    const readdir = sinon.stub().resolves(['1-1']);
    const readFile = sinon.stub().resolves(Buffer.from('1d6b\n'));
    const frigateManager = buildManager({ access, readdir, readFile });

    await frigateManager.detectHardware();

    expect(frigateManager.coralAvailable).to.equal(false);
    expect(frigateManager.coralDeviceType).to.equal(null);
  });
});
