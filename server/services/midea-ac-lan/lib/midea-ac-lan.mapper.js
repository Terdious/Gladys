const { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS } = require('../../../utils/constants');

const MODES = {
  auto: 'auto',
  cool: 'cool',
  heat: 'heat',
  dry: 'dry',
  fanonly: 'fan_only' // lib -> Gladys/UX
};

function buildFeaturesForAc(cap) {
  // Capabilities optional; map to Gladys categories/types
  const minT = cap.minTempCool ?? 16;
  const maxT = cap.maxTempHeat ?? 31;
  return [
    {
      name: 'Power',
      category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
      type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.BINARY,
      read_only: false,
      has_feedback: true,
      min: 0,
      max: 1,
      unit: DEVICE_FEATURE_UNITS.BOOLEAN
    },
    {
      name: 'Target temperature',
      category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
      type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE,
      read_only: false,
      has_feedback: false,
      min: minT,
      max: maxT,
      unit: DEVICE_FEATURE_UNITS.CELSIUS
    },
    {
      name: 'Mode',
      category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
      type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.MODE,
      read_only: false,
      has_feedback: false,
      min: 0,
      max: 0,
      available_values: Object.values(MODES)
    },
    {
      name: 'Room temperature',
      category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
      type: 'temperature',
      read_only: true,
      has_feedback: false,
      min: -50,
      max: 100,
      unit: DEVICE_FEATURE_UNITS.CELSIUS
    }
  ];
}

function statusToFeatureValues(status) {
  // status = ac.getStatus()
  return {
    power: Boolean(status.powerOn),
    targetTemperature: status.temperatureSetpoint ?? status.setpoint,
    mode: MODES[status.mode?.description] || MODES[status.mode] || 'auto',
    currentTemperature: status.indoorTemperature ?? null
  };
}

function featureToSetStatusPatch(type, value) {
  switch (type) {
    case DEVICE_FEATURE_TYPES.AIR_CONDITIONING.BINARY:
      return { powerOn: !!value };
    case DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE:
      return { setpoint: Number(value) };
    case DEVICE_FEATURE_TYPES.AIR_CONDITIONING.MODE:
      return { mode: String(value) };
    default:
      return null;
  }
}

module.exports = { buildFeaturesForAc, statusToFeatureValues, featureToSetStatusPatch };
