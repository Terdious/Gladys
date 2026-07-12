const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateService = require('../../../services/frigate');

const gladys = {
  event: {
    emit: fake.resolves(null),
  },
  variable: {
    getValue: fake.resolves(null),
  },
  system: {
    isDocker: fake.resolves(false),
  },
};

const serviceId = 'a810b8db-6d04-4697-bed3-c4b72c996279';

describe('FrigateService', () => {
  let frigateService;

  beforeEach(() => {
    frigateService = FrigateService(gladys, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should start service', async () => {
    frigateService.device.init = fake.resolves(null);
    await frigateService.start();
    assert.calledOnce(frigateService.device.init);
  });

  it('should stop service', async () => {
    frigateService.device.disconnect = fake.resolves(null);
    await frigateService.stop();
    assert.calledOnce(frigateService.device.disconnect);
  });

  it('should return service is not used', async () => {
    const used = await frigateService.isUsed();
    expect(used).to.equal(false);
  });

  it('should return service is used', async () => {
    frigateService.device.gladysConnected = true;
    frigateService.device.frigateConnected = true;
    const used = await frigateService.isUsed();
    expect(used).to.equal(true);
  });
});
