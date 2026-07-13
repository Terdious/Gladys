const { expect } = require('chai');

const { CAMERA_CATALOG } = require('../../../../services/frigate/lib/cameraCatalog');
const { SOURCE_TYPES } = require('../../../../services/frigate/lib/constants');

describe('frigate cameraCatalog', () => {
  it('should have a valid structure', () => {
    expect(CAMERA_CATALOG).to.be.an('array');
    expect(CAMERA_CATALOG.length).to.be.at.least(1);

    const brandKeys = CAMERA_CATALOG.map((brand) => brand.key);
    expect(new Set(brandKeys).size).to.equal(brandKeys.length);

    CAMERA_CATALOG.forEach((brand) => {
      expect(brand.key).to.be.a('string');
      expect(brand.brand).to.be.a('string');
      expect(brand.unknownModelNoteKey).to.be.a('string');
      expect(brand.models).to.be.an('array');
      expect(brand.models.length).to.be.at.least(1);

      const modelNames = brand.models.map((model) => model.name);
      expect(new Set(modelNames).size).to.equal(modelNames.length);

      brand.models.forEach((model) => {
        expect(model.name).to.be.a('string');
        expect(model.noteKey).to.be.a('string');
        expect(Object.values(SOURCE_TYPES)).to.include(model.preset.sourceType);
      });
    });
  });
});
