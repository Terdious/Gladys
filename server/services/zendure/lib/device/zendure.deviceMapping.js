const {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} = require('../../../../utils/constants');

const { SUPPORTED_PRODUCT_MODELS } = require('../utils/zendure.constants');

const MODEL_FEATURES = {
  [SUPPORTED_PRODUCT_MODELS.SOLARFLOW_800_PRO]: [
    {
      key: 'batteryLevel',
      name: 'Battery level',
      category: DEVICE_FEATURE_CATEGORIES.SOLAR_BATTERY,
      type: DEVICE_FEATURE_TYPES.SOLAR_BATTERY.BATTERY_LEVEL,
      unit: DEVICE_FEATURE_UNITS.PERCENT,
      min: 0,
      max: 100,
      metricPaths: ['electricLevel', 'properties.electricLevel'],
    },
    {
      key: 'batteryInputPower',
      name: 'Battery input power',
      category: DEVICE_FEATURE_CATEGORIES.SOLAR_BATTERY,
      type: DEVICE_FEATURE_TYPES.SOLAR_BATTERY.BATTERY_INPUT_POWER,
      unit: DEVICE_FEATURE_UNITS.WATT,
      min: 0,
      max: 12000,
      metricPaths: ['packInputPower', 'properties.packInputPower'],
    },
    {
      key: 'batteryOutputPower',
      name: 'Battery output power',
      category: DEVICE_FEATURE_CATEGORIES.SOLAR_BATTERY,
      type: DEVICE_FEATURE_TYPES.SOLAR_BATTERY.BATTERY_OUTPUT_POWER,
      unit: DEVICE_FEATURE_UNITS.WATT,
      min: 0,
      max: 12000,
      metricPaths: ['outputPackPower', 'properties.outputPackPower'],
    },
    {
      key: 'homeOutputPower',
      name: 'Home output power',
      category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
      type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER,
      unit: DEVICE_FEATURE_UNITS.WATT,
      min: 0,
      max: 12000,
      metricPaths: ['outputHomePower', 'properties.outputHomePower'],
    },
    {
      key: 'solarInputPower',
      name: 'Solar input power',
      category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
      type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER,
      unit: DEVICE_FEATURE_UNITS.WATT,
      min: 0,
      max: 12000,
      metricPaths: ['solarInputPower', 'properties.solarInputPower'],
    },
  ],
};

/**
 * @description Return Zendure mapped features for one product model.
 * @param {string} productModel - Raw product model from cloud.
 * @returns {Array} Feature mappings.
 * @example
 * getFeaturesMappingForModel('SolarFlow 800 Pro');
 */
function getFeaturesMappingForModel(productModel) {
  const normalizedProductModel = String(productModel || '').toLowerCase().trim();
  return MODEL_FEATURES[normalizedProductModel] || [];
}

const METRIC_PATHS_BY_KEY = Object.values(MODEL_FEATURES)
  .flat()
  .reduce((accumulator, featureMapping) => {
    accumulator[featureMapping.key] = featureMapping.metricPaths;
    return accumulator;
  }, {});

module.exports = {
  MODEL_FEATURES,
  METRIC_PATHS_BY_KEY,
  getFeaturesMappingForModel,
};
