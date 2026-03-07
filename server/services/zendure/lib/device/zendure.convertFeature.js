/**
 * @description Convert one Zendure feature mapping entry to Gladys feature.
 * @param {string} externalId - Device external id.
 * @param {object} featureMapping - Mapping definition.
 * @returns {object} Gladys feature object.
 * @example
 * convertFeature('zendure:abc', { key: 'batteryLevel', name: 'Battery level' });
 */
function convertFeature(externalId, featureMapping) {
  const featureExternalId = `${externalId}:${featureMapping.key}`;

  return {
    name: featureMapping.name,
    external_id: featureExternalId,
    selector: featureExternalId,
    read_only: true,
    has_feedback: false,
    min: featureMapping.min,
    max: featureMapping.max,
    category: featureMapping.category,
    type: featureMapping.type,
    unit: featureMapping.unit,
  };
}

module.exports = {
  convertFeature,
};
