const { EVENTS } = require('../../../../utils/constants');
const logger = require('../../../../utils/logger');
const { readValues } = require('./netatmo.deviceMapping');

/**
 * @description Save values of Smart Anemometer Module NAModule2 - Weather Station .
 * @param {object} deviceGladys - Device object in Gladys.
 * @param {object} deviceNetatmo - Device object coming from the Netatmo API.
 * @param {string} externalId - Device identifier in gladys.
 * @example updateNAModule2(deviceGladys, deviceNetatmo, externalId);
 */
async function updateNAModule2(deviceGladys, deviceNetatmo, externalId) {
  const { dashboard_data: dashboardData } = deviceNetatmo;
  try {
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:battery_percent`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: `${externalId}:battery_percent`,
          state: readValues[feature.category][feature.type](deviceNetatmo.battery_percent),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:wind_strength`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](deviceNetatmo.wind_strength),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:wind_angle`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](deviceNetatmo.wind_angle),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:wind_gust`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](deviceNetatmo.wind_gust),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:wind_gust_angle`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](deviceNetatmo.wind_gust_angle),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:max_wind_str`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](dashboardData.max_wind_str),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:max_wind_angle`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](dashboardData.max_wind_angle),
        });
      });
    deviceGladys.features
      .filter((feature) => feature.external_id === `${externalId}:rf_strength`)
      .forEach((feature) => {
        this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
          device_feature_external_id: feature.external_id,
          state: readValues[feature.category][feature.type](deviceNetatmo.rf_strength),
        });
      });
  } catch (e) {
    logger.error('deviceGladys NAModule2: ', deviceGladys.name, 'error: ', e);
  }
}

module.exports = {
  updateNAModule2,
};
