const {
  OnOff,
  OccupancySensing,
  IlluminanceMeasurement,
  TemperatureMeasurement,
  WindowCovering,
  LevelControl,
  ColorControl,
  RelativeHumidityMeasurement,
  Thermostat,
  ElectricalPowerMeasurement,
  // eslint-disable-next-line import/no-unresolved
} = require('@matter/main/clusters');
const Promise = require('bluebird');
const { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES, DEVICE_FEATURE_UNITS } = require('../../../utils/constants');
const { slugify } = require('../../../utils/slugify');

/**
 * @description Convert a Matter device to a Gladys device.
 * @param {string} serviceId - The service ID.
 * @param {bigint} nodeId - The node ID of the device.
 * @param {object} device - The device on the node.
 * @param {object} nodeDetailDeviceDataBasicInformation - The node detail device data basic information.
 * @param {string} devicePath - The path of the device.
 * @example
 * const gladysDevice = await convertToGladysDevice(serviceId, nodeId, node, device);
 * @returns {Promise<object>} The Gladys device.
 */
async function convertToGladysDevice(serviceId, nodeId, device, nodeDetailDeviceDataBasicInformation, devicePath) {
  const gladysDevice = {
    name: device.name,
    external_id: `matter:${nodeId}:${devicePath}`,
    selector: slugify(`matter-${device.name}`, true),
    service_id: serviceId,
    should_poll: false,
    features: [],
    params: [],
  };
  if (nodeDetailDeviceDataBasicInformation) {
    gladysDevice.name = `${nodeDetailDeviceDataBasicInformation.vendorName
      } (${nodeDetailDeviceDataBasicInformation.nodeLabel ||
      nodeDetailDeviceDataBasicInformation.productLabel ||
      nodeDetailDeviceDataBasicInformation.productName ||
      device.name})`;
    if (nodeDetailDeviceDataBasicInformation.uniqueId) {
      gladysDevice.params.push({
        name: 'UNIQUE_ID',
        value: nodeDetailDeviceDataBasicInformation.uniqueId,
      });
    }
    if (nodeDetailDeviceDataBasicInformation.serialNumber) {
      gladysDevice.params.push({
        name: 'SERIAL_NUMBER',
        value: nodeDetailDeviceDataBasicInformation.serialNumber,
      });
    }
  }

  // Add endpoint number to the name so the user can identify the device
  gladysDevice.name += ` ${device.number}`;

  if (device.clusterClients) {
    await Promise.each(Array.from(device.clusterClients.entries()), async ([clusterIndex, clusterClient]) => {
      const commonNewFeature = {
        name: `${clusterClient.name} - ${clusterClient.endpointId}`,
        selector: slugify(`matter-${device.name}-${clusterClient.name}`, true),
      };
      if (clusterIndex === OnOff.Complete.id) {
        gladysDevice.features.push({
          ...commonNewFeature,
          category: DEVICE_FEATURE_CATEGORIES.SWITCH,
          type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
          read_only: false,
          has_feedback: true,
          external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}`,
          min: 0,
          max: 1,
        });
      } else if (clusterIndex === OccupancySensing.Complete.id) {
        gladysDevice.features.push({
          ...commonNewFeature,
          category: DEVICE_FEATURE_CATEGORIES.MOTION_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
          read_only: true,
          has_feedback: true,
          external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}`,
          min: 0,
          max: 1,
        });
      } else if (clusterIndex === IlluminanceMeasurement.Complete.id) {
        gladysDevice.features.push({
          ...commonNewFeature,
          category: DEVICE_FEATURE_CATEGORIES.LIGHT_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          read_only: true,
          has_feedback: true,
          unit: DEVICE_FEATURE_UNITS.LUX,
          external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}`,
          min: 1,
          max: 6553,
        });
      } else if (clusterIndex === TemperatureMeasurement.Complete.id) {
        gladysDevice.features.push({
          ...commonNewFeature,
          category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          read_only: true,
          has_feedback: true,
          unit: DEVICE_FEATURE_UNITS.CELSIUS,
          external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}`,
          min: -100,
          max: 200,
        });
      } else if (clusterIndex === WindowCovering.Complete.id) {
        gladysDevice.features.push({
          name: `${clusterClient.name} - ${clusterClient.endpointId} (Position)`,
          selector: slugify(`matter-${device.name}-${clusterClient.name}-position`, true),
          category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
          type: DEVICE_FEATURE_TYPES.SHUTTER.POSITION,
          read_only: false,
          has_feedback: true,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:position`,
          min: 0,
          max: 100,
        });
        gladysDevice.features.push({
          name: `${clusterClient.name} - ${clusterClient.endpointId} (State)`,
          selector: slugify(`matter-${device.name}-${clusterClient.name}-state`, true),
          category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
          type: DEVICE_FEATURE_TYPES.SHUTTER.STATE,
          read_only: false,
          has_feedback: true,
          unit: null,
          external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:state`,
          min: 0,
          max: 1,
        });
      } else if (
        clusterIndex === LevelControl.Complete.id &&
        clusterClient.supportedFeatures &&
        clusterClient.supportedFeatures.lighting
      ) {
        const minLevel = await clusterClient.getMinLevelAttribute();
        const maxLevel = await clusterClient.getMaxLevelAttribute();
        gladysDevice.features.push({
          ...commonNewFeature,
          category: DEVICE_FEATURE_CATEGORIES.LIGHT,
          type: DEVICE_FEATURE_TYPES.LIGHT.BRIGHTNESS,
          read_only: false,
          has_feedback: true,
          external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}`,
          min: minLevel,
          max: maxLevel,
        });
      } else if (clusterIndex === ColorControl.Complete.id) {
        if (clusterClient.supportedFeatures.hueSaturation) {
          gladysDevice.features.push({
            name: `${clusterClient.name} - ${clusterClient.endpointId} (Color)`,
            selector: slugify(`matter-${device.name}-${clusterClient.name}-color`, true),
            category: DEVICE_FEATURE_CATEGORIES.LIGHT,
            type: DEVICE_FEATURE_TYPES.LIGHT.COLOR,
            read_only: false,
            has_feedback: true,
            external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:color`,
            min: 0,
            max: 6579300,
          });
        }
      } else if (clusterIndex === RelativeHumidityMeasurement.Complete.id) {
        gladysDevice.features.push({
          ...commonNewFeature,
          category: DEVICE_FEATURE_CATEGORIES.HUMIDITY_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          read_only: true,
          has_feedback: true,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}`,
          min: 0,
          max: 100,
        });
      } else if (clusterIndex === Thermostat.Complete.id) {
        if (clusterClient.supportedFeatures.heating) {
          gladysDevice.features.push({
            name: `${clusterClient.name} - ${clusterClient.endpointId} (Heating)`,
            selector: slugify(`matter-${device.name}-${clusterClient.name}-heating`, true),
            category: DEVICE_FEATURE_CATEGORIES.THERMOSTAT,
            type: DEVICE_FEATURE_TYPES.THERMOSTAT.TARGET_TEMPERATURE,
            read_only: false,
            has_feedback: true,
            unit: DEVICE_FEATURE_UNITS.CELSIUS,
            external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:heating`,
            min: -100,
            max: 200,
          });
        }
        if (clusterClient.supportedFeatures.cooling) {
          gladysDevice.features.push({
            name: `${clusterClient.name} - ${clusterClient.endpointId} (Cooling)`,
            selector: slugify(`matter-${device.name}-${clusterClient.name}-cooling`, true),
            category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
            type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE,
            read_only: false,
            has_feedback: true,
            unit: DEVICE_FEATURE_UNITS.CELSIUS,
            external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:cooling`,
            min: -100,
            max: 200,
          });
        }
      } else if (clusterIndex === ElectricalPowerMeasurement.Complete.id) {
        if (clusterClient.supportedFeatures.DIRC) {
          gladysDevice.features.push({
            name: `${clusterClient.name} - ${clusterClient.endpointId} (DC Power)`,
            selector: slugify(`matter-${device.name}-${clusterClient.name}-dc-power`, true),
            category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
            type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER,
            read_only: true,
            has_feedback: true,
            unit: DEVICE_FEATURE_UNITS.WATT,
            external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:dc-power`,
            min: 0,
            max: 100000,
          });
        }

        if (clusterClient.supportedFeatures.ALTC) {
          gladysDevice.features.push({
            name: `${clusterClient.name} - ${clusterClient.endpointId} (AC Power)`,
            selector: slugify(`matter-${device.name}-${clusterClient.name}-ac-power`, true),
            category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
            type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER,
            read_only: true,
            has_feedback: true,
            unit: DEVICE_FEATURE_UNITS.WATT,
            external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:ac-power`,
            min: 0,
            max: 100000,
          });
        }

        if (clusterClient.supportedFeatures.POLY) {
          gladysDevice.features.push({
            name: `${clusterClient.name} - ${clusterClient.endpointId} (Polyphase Power)`,
            selector: slugify(`matter-${device.name}-${clusterClient.name}-polyphase-power`, true),
            category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
            type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER,
            read_only: true,
            has_feedback: true,
            external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:polyphase-power`,
            min: 0,
            max: 100000,
          });
        }

        if (clusterClient.supportedFeatures.HARM) {
          gladysDevice.features.push({
            name: `${clusterClient.name} - ${clusterClient.endpointId} (Harmonics)`,
            selector: slugify(`matter-${device.name}-${clusterClient.name}-harmonics`, true),
            category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
            type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.HARMONICS,
            read_only: true,
            has_feedback: true,
            external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:harmonics`,
            min: 0,
            max: 100,
          });
        }

        if (clusterClient.supportedFeatures.PWRQ) {
          gladysDevice.features.push({
            name: `${clusterClient.name} - ${clusterClient.endpointId} (Power Quality)`,
            selector: slugify(`matter-${device.name}-${clusterClient.name}-power-quality`, true),
            category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
            type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER_QUALITY,
            read_only: true,
            has_feedback: true,
            unit: DEVICE_FEATURE_UNITS.PERCENT,
            external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:power-quality`,
            min: 0,
            max: 100,
          });
        }

        const attributes = [
          { attr: 'RMSPower', name: 'Instantaneous Power', type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER, unit: DEVICE_FEATURE_UNITS.WATT, divisor: 1000 },
          { attr: 'Voltage', name: 'Voltage', type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.VOLTAGE, unit: DEVICE_FEATURE_UNITS.VOLT, divisor: 1000 },
          { attr: 'ActiveCurrent', name: 'Active Current', type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.CURRENT, unit: DEVICE_FEATURE_UNITS.AMPERE, divisor: 1000 },
          { attr: 'ReactiveCurrent', name: 'Reactive Current', type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.CURRENT, unit: DEVICE_FEATURE_UNITS.AMPERE, divisor: 1000 },
          { attr: 'Frequency', name: 'Frequency', type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.FREQUENCY, unit: DEVICE_FEATURE_UNITS.HERTZ, divisor: 1000 },
          { attr: 'PowerFactor', name: 'Power Factor', type: DEVICE_FEATURE_TYPES.ENERGY_SENSOR.POWER_FACTOR, unit: DEVICE_FEATURE_UNITS.PERCENT, divisor: 1 },
        ];

        attributes.forEach(({ attr, name, type, unit, divisor }) => {
          if (clusterClient.attributes[attr] !== undefined) {
            gladysDevice.features.push({
              name: `${clusterClient.name} - ${clusterClient.endpointId} (${name})`,
              selector: slugify(`matter-${device.name}-${clusterClient.name}-${attr.toLowerCase()}`, true),
              category: DEVICE_FEATURE_CATEGORIES.ENERGY_SENSOR,
              type: type,
              read_only: true,
              has_feedback: true,
              unit: unit,
              external_id: `matter:${nodeId}:${devicePath}:${clusterIndex}:${attr.toLowerCase()}`,
              min: 0,
              max: 100000,
            });
          }
        });
      }
    });
  }
  return gladysDevice;
}

module.exports = {
  convertToGladysDevice,
};
