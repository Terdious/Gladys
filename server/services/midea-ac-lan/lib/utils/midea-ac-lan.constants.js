// Ne pas reprendre les constantes Gladys ici: nous avons besoin des clés 'CLIMATE'
// et des types 'climate.*' qui n'existent pas tel quel dans `utils/constants`.
// On expose donc nos propres constantes, cohérentes avec le service.

const CATEGORY = {
  CLIMATE: 'climate',
  TEMPERATURE_SENSOR: 'temperature-sensor',
  HUMIDITY_SENSOR: 'humidity-sensor',
  SWITCH: 'switch',
  FAN: 'fan',
  LIGHT: 'light'
};

const TYPE = {
  CLIMATE: {
    MODE: 'climate-mode',
    TARGET_TEMPERATURE: 'climate.target-temperature',
    CURRENT_TEMPERATURE: 'climate.temperature',
    POWER: 'climate.power',
    FAN_SPEED: 'climate.fan-speed',
    SWING: 'climate.swing'
  },
  SWITCH: { BINARY: 'switch.binary' },
  TEMPERATURE_SENSOR: { TEMPERATURE: 'temperature' },
  HUMIDITY_SENSOR: { HUMIDITY: 'humidity' },
  FAN: { SPEED: 'fan.speed' }
};

const UNIT = {
  CELSIUS: 'celsius',
  PERCENT: 'percent',
  BOOLEAN: 'boolean'
};

const STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected'
};

module.exports = { CATEGORY, TYPE, UNIT, STATUS };
