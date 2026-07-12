const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate getDockerContainer', () => {
  afterEach(() => {
    sinon.reset();
  });

  it('should only return the exact name match, not substring matches', async () => {
    // Docker name filters match substrings: filtering on 'gladys-frigate'
    // also returns 'gladys-frigate-mqtt'
    const gladys = {
      system: {
        getContainers: fake.resolves([
          { id: 'frigate-id', name: '/gladys-frigate', state: 'running' },
          { id: 'mqtt-id', name: '/gladys-frigate-mqtt', state: 'running' },
        ]),
      },
    };
    const frigateManager = new FrigateManager(gladys, null, serviceId);

    const containers = await frigateManager.getDockerContainer('gladys-frigate');

    assert.calledOnceWithExactly(gladys.system.getContainers, {
      all: true,
      filters: { name: ['gladys-frigate'] },
    });
    expect(containers).to.deep.equal([{ id: 'frigate-id', name: '/gladys-frigate', state: 'running' }]);
  });

  it('should return empty array when no exact match', async () => {
    const gladys = {
      system: {
        getContainers: fake.resolves([{ id: 'mqtt-id', name: '/gladys-frigate-mqtt', state: 'running' }]),
      },
    };
    const frigateManager = new FrigateManager(gladys, null, serviceId);

    const containers = await frigateManager.getDockerContainer('gladys-frigate');

    expect(containers).to.deep.equal([]);
  });
});
