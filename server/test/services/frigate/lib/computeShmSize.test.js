const { expect } = require('chai');

const { computeShmSize } = require('../../../../services/frigate/lib/computeShmSize');

describe('frigate computeShmSize', () => {
  it('should return the validated base size for zero or one camera', () => {
    expect(computeShmSize(0)).to.equal(268435456);
    expect(computeShmSize(1)).to.equal(268435456);
  });

  it('should add headroom per extra camera', () => {
    expect(computeShmSize(2)).to.equal(268435456 + 67108864);
    expect(computeShmSize(4)).to.equal(268435456 + 3 * 67108864);
  });
});
