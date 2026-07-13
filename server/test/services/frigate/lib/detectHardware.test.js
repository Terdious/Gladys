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

  const noCoralStubs = () => {
    const access = sinon.stub().rejects(new Error('ENOENT'));
    const readdir = sinon.stub().rejects(new Error('ENOENT'));
    const readFile = sinon.stub().rejects(new Error('ENOENT'));
    return { access, readdir, readFile };
  };

  it('should select an Intel render node (OpenVINO capable)', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    readdir.withArgs('/dev/dri').resolves(['card0', 'renderD128']);
    readFile.withArgs('/sys/class/drm/renderD128/device/vendor').resolves(Buffer.from('0x8086\n'));
    const frigateManager = buildManager({ access, readdir, readFile });

    const vaapiAvailable = await frigateManager.detectHardware();

    expect(vaapiAvailable).to.equal(true);
    expect(frigateManager.vaapiAvailable).to.equal(true);
    expect(frigateManager.openvinoCapable).to.equal(true);
    expect(frigateManager.renderDevicePath).to.equal('/dev/dri/renderD128');
    expect(frigateManager.coralAvailable).to.equal(false);
  });

  it('should select the Intel node on a multi-GPU host whatever the node order', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    readdir.withArgs('/dev/dri').resolves(['card0', 'card1', 'renderD128', 'renderD129']);
    // renderD128 is the NVIDIA card here: it must not be selected
    readFile.withArgs('/sys/class/drm/renderD128/device/vendor').resolves(Buffer.from('0x10de\n'));
    readFile.withArgs('/sys/class/drm/renderD129/device/vendor').resolves(Buffer.from('0x8086\n'));
    const frigateManager = buildManager({ access, readdir, readFile });

    await frigateManager.detectHardware();

    expect(frigateManager.openvinoCapable).to.equal(true);
    expect(frigateManager.renderDevicePath).to.equal('/dev/dri/renderD129');
  });

  it('should keep VAAPI decoding only on an AMD GPU', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    readdir.withArgs('/dev/dri').resolves(['renderD128']);
    readFile.withArgs('/sys/class/drm/renderD128/device/vendor').resolves(Buffer.from('0x1002\n'));
    const frigateManager = buildManager({ access, readdir, readFile });

    await frigateManager.detectHardware();

    expect(frigateManager.vaapiAvailable).to.equal(true);
    expect(frigateManager.openvinoCapable).to.equal(false);
    expect(frigateManager.renderDevicePath).to.equal('/dev/dri/renderD128');
  });

  it('should not use an NVIDIA-only render node', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    readdir.withArgs('/dev/dri').resolves(['renderD128']);
    readFile.withArgs('/sys/class/drm/renderD128/device/vendor').resolves(Buffer.from('0x10de\n'));
    const frigateManager = buildManager({ access, readdir, readFile });

    const vaapiAvailable = await frigateManager.detectHardware();

    expect(vaapiAvailable).to.equal(false);
    expect(frigateManager.openvinoCapable).to.equal(false);
    expect(frigateManager.renderDevicePath).to.equal(null);
  });

  it('should keep the historical behavior when the GPU vendors are unreadable', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    readdir.withArgs('/dev/dri').resolves(['renderD128']);
    // readFile rejects for every vendor (unusual /sys setup)
    const frigateManager = buildManager({ access, readdir, readFile });

    await frigateManager.detectHardware();

    expect(frigateManager.vaapiAvailable).to.equal(true);
    expect(frigateManager.openvinoCapable).to.equal(true);
    expect(frigateManager.renderDevicePath).to.equal('/dev/dri/renderD128');
  });

  it('should fallback to CPU when there is no render node at all', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    readdir.withArgs('/dev/dri').resolves(['card0']);
    const frigateManager = buildManager({ access, readdir, readFile });

    const vaapiAvailable = await frigateManager.detectHardware();

    expect(vaapiAvailable).to.equal(false);
    expect(frigateManager.renderDevicePath).to.equal(null);
  });

  it('should fallback to CPU when /dev/dri does not exist', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    const frigateManager = buildManager({ access, readdir, readFile });

    const vaapiAvailable = await frigateManager.detectHardware();

    expect(vaapiAvailable).to.equal(false);
  });

  it('should detect a PCIe Coral', async () => {
    const { readdir, readFile } = noCoralStubs();
    const access = sinon.stub();
    access.withArgs('/dev/apex_0').resolves();
    const frigateManager = buildManager({ access, readdir, readFile });

    await frigateManager.detectHardware();

    expect(frigateManager.coralAvailable).to.equal(true);
    expect(frigateManager.coralDeviceType).to.equal('pcie');
  });

  it('should detect a USB Coral through its vendor id', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    readdir.withArgs('/sys/bus/usb/devices').resolves(['1-1', '1-2', 'usb1']);
    readFile.withArgs('/sys/bus/usb/devices/1-1/idVendor').resolves(Buffer.from('1d6b\n'));
    readFile.withArgs('/sys/bus/usb/devices/1-2/idVendor').resolves(Buffer.from('1a6e\n'));
    const frigateManager = buildManager({ access, readdir, readFile });

    await frigateManager.detectHardware();

    expect(frigateManager.coralAvailable).to.equal(true);
    expect(frigateManager.coralDeviceType).to.equal('usb');
  });

  it('should not detect a Coral when no USB device matches', async () => {
    const { access, readdir, readFile } = noCoralStubs();
    readdir.withArgs('/sys/bus/usb/devices').resolves(['1-1']);
    readFile.withArgs('/sys/bus/usb/devices/1-1/idVendor').resolves(Buffer.from('1d6b\n'));
    const frigateManager = buildManager({ access, readdir, readFile });

    await frigateManager.detectHardware();

    expect(frigateManager.coralAvailable).to.equal(false);
    expect(frigateManager.coralDeviceType).to.equal(null);
  });
});
