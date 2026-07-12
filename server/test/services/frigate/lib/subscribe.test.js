const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate subscribe', () => {
  afterEach(() => {
    sinon.reset();
  });

  it('should subscribe on broker and store binding', () => {
    const frigateManager = new FrigateManager({}, null, serviceId);
    frigateManager.mqttClient = {
      subscribe: fake.returns(null),
    };
    const callback = () => {};

    frigateManager.subscribe('frigate/#', callback);

    assert.calledOnceWithExactly(frigateManager.mqttClient.subscribe, 'frigate/#');
    expect(frigateManager.topicBinds['frigate/#']).to.equal(callback);
  });

  it('should only store binding when client is not connected', () => {
    const frigateManager = new FrigateManager({}, null, serviceId);
    const callback = () => {};

    frigateManager.subscribe('frigate/#', callback);

    expect(frigateManager.topicBinds['frigate/#']).to.equal(callback);
  });
});
