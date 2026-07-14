const { expect } = require('chai');
const sinon = require('sinon');

const proxyquire = require('proxyquire').noCallThru();

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate getImage', () => {
  let FrigateManager;
  let axios;
  let frigateManager;

  beforeEach(() => {
    axios = {
      get: sinon.stub().resolves({
        data: Buffer.from('small-image'),
        headers: { 'content-type': 'image/webp' },
      }),
    };
    const { getImage } = proxyquire('../../../../services/frigate/lib/getImage', {
      axios,
    });
    FrigateManager = proxyquire('../../../../services/frigate/lib', {
      './getImage': { getImage },
    });

    frigateManager = new FrigateManager({}, null, serviceId);
    frigateManager.frigateApiPort = 5000;
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should return the latest image in base64', async () => {
    const image = await frigateManager.getImage({ external_id: 'frigate:c660' });

    expect(image).to.equal(`image/webp;base64,${Buffer.from('small-image').toString('base64')}`);
    expect(axios.get.firstCall.args[0]).to.equal('http://127.0.0.1:5000/api/c660/latest.webp?height=360');
  });

  it('should default content type to image/webp', async () => {
    axios.get.resolves({ data: Buffer.from('small-image'), headers: {} });

    const image = await frigateManager.getImage({ external_id: 'frigate:c660' });

    expect(image.startsWith('image/webp;base64,')).to.equal(true);
  });

  it('should throw on invalid external id', async () => {
    try {
      await frigateManager.getImage({ external_id: 'other:c660' });
      sinon.assert.fail();
    } catch (e) {
      expect(e.message).to.contain('invalid external id');
    }
  });

  it('should throw when external id is missing', async () => {
    try {
      await frigateManager.getImage({});
      sinon.assert.fail();
    } catch (e) {
      expect(e.message).to.contain('invalid external id');
    }
  });

  it('should throw when API port is not allocated', async () => {
    frigateManager.frigateApiPort = null;
    try {
      await frigateManager.getImage({ external_id: 'frigate:c660' });
      sinon.assert.fail();
    } catch (e) {
      expect(e.message).to.contain('API port is not allocated');
    }
  });

  it('should throw when the image is too big', async () => {
    axios.get.resolves({
      data: Buffer.alloc(200 * 1024),
      headers: { 'content-type': 'image/webp' },
    });
    try {
      await frigateManager.getImage({ external_id: 'frigate:c660' });
      sinon.assert.fail();
    } catch (e) {
      expect(e.message).to.contain('is too big');
    }
  });

  it('should fetch the image through the remote authenticated API in remote mode', async () => {
    frigateManager.mode = 'remote';
    const { fake } = sinon;
    frigateManager.remoteApiGet = fake.resolves({
      data: Buffer.from('remote-image'),
      headers: { 'content-type': 'image/webp' },
    });

    const image = await frigateManager.getImage({ external_id: 'frigate:c660' });

    expect(image).to.equal(`image/webp;base64,${Buffer.from('remote-image').toString('base64')}`);
    sinon.assert.calledWith(frigateManager.remoteApiGet, '/api/c660/latest.webp?height=360', {
      responseType: 'arraybuffer',
    });
  });
});
