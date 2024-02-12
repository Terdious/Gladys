const { EVENTS } = require('../../../../utils/constants');
const logger = require('../../../../utils/logger');
const { readValues } = require('../device/netatmo.deviceMapping');

/**
 * @description Save values of Smart Indoor Module NAModule4 - Weather Station .
 * @param {object} deviceGladys - Device object in Gladys.
 * @param {object} deviceNetatmo - Device object coming from the Netatmo API.
 * @param {string} externalId - Device identifier in gladys.
 * @example updateNAModule4(deviceGladys, deviceNetatmo, externalId);
 */
async function updateNAModule4(deviceGladys, deviceNetatmo, externalId) {
  const { room, dashboard_data: dashboardData } = deviceNetatmo;
  try {
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:battery_percent`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](deviceNetatmo.battery_percent),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:temperature`)
      .forEach((feature) => {
        const valueDeviceNetatmo = deviceNetatmo.temperature || dashboardData.Temperature;
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](valueDeviceNetatmo),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:therm_measured_temperature`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](room.therm_measured_temperature),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:co2`)
      .forEach((feature) => {
        const valueDeviceNetatmo = deviceNetatmo.co2 || dashboardData.CO2;
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](valueDeviceNetatmo),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:humidity`)
      .forEach((feature) => {
        const valueDeviceNetatmo = deviceNetatmo.humidity || dashboardData.Humidity;
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](valueDeviceNetatmo),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:min_temp`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](dashboardData.min_temp),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:max_temp`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](dashboardData.max_temp),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:rf_strength`)
      .forEach((feature) => {
        const valueDeviceNetatmo = deviceNetatmo.rf_strength || dashboardData.rf_status;
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](valueDeviceNetatmo),
        });
      });
  } catch (e) {
    logger.error('deviceGladys NAModule4: ', deviceGladys.name, 'error: ', e);
  }
}

module.exports = {
  updateNAModule4,
};
