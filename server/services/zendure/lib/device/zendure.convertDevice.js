const { DEVICE_POLL_FREQUENCIES } = require('../../../../utils/constants');

const { DEVICE_PARAM_NAME } = require('../utils/zendure.constants');
const { getFeaturesMappingForModel } = require('./zendure.deviceMapping');
const { convertFeature } = require('./zendure.convertFeature');

/**
 * @description Add one device param only when value exists.
 * @param {Array} params - Target params array.
 * @param {string} name - Param name.
 * @param {string|number|boolean} value - Param value.
 * @returns {void}
 * @example
 * addParam(params, 'zendure-local-ip', '192.168.1.10');
 */
function addParam(params, name, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  params.push({
    name,
    value: String(value),
  });
}

/**
 * @description Transform Zendure cloud device to Gladys device.
 * @param {object} zendureDevice - Zendure cloud device.
 * @param {string} serviceId - Gladys service identifier.
 * @returns {object} Gladys formatted device.
 * @example
 * convertDevice({ deviceKey: 'abc', productModel: 'SolarFlow 800 Pro' }, 'service-id');
 */
function convertDevice(zendureDevice, serviceId) {
  const deviceKey = zendureDevice.deviceKey || zendureDevice.id;
  const productModel = zendureDevice.productModel || zendureDevice.productName || 'Unknown';
  const name = zendureDevice.deviceName || zendureDevice.name || productModel;
  const params = [];

  addParam(params, DEVICE_PARAM_NAME.DEVICE_KEY, deviceKey);
  addParam(params, DEVICE_PARAM_NAME.PRODUCT_KEY, zendureDevice.productKey);
  addParam(params, DEVICE_PARAM_NAME.PRODUCT_MODEL, productModel);
  addParam(params, DEVICE_PARAM_NAME.LOCAL_IP, zendureDevice.ip);
  addParam(params, DEVICE_PARAM_NAME.LOCAL_MQTT_PROTOCOL, zendureDevice.protocol);
  addParam(params, DEVICE_PARAM_NAME.LOCAL_MQTT_SERVER, zendureDevice.server);
  addParam(params, DEVICE_PARAM_NAME.LOCAL_MQTT_PORT, zendureDevice.port);
  addParam(params, DEVICE_PARAM_NAME.LOCAL_MQTT_USERNAME, zendureDevice.username);
  addParam(params, DEVICE_PARAM_NAME.LOCAL_MQTT_PASSWORD, zendureDevice.password);
  addParam(params, DEVICE_PARAM_NAME.LOCAL_MQTT_ENABLED, zendureDevice.enable);

  const externalId = `zendure:${deviceKey}`;
  const featuresMapping = getFeaturesMappingForModel(productModel);
  const isSupportedModel = featuresMapping.length > 0;
  const isPartiallySupportedModel = isSupportedModel;
  const features = featuresMapping.map((featureMapping) => convertFeature(externalId, featureMapping));

  return {
    name,
    external_id: externalId,
    selector: externalId,
    model: productModel,
    service_id: serviceId,
    should_poll: false,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS,
    params,
    features,
    partially_supported: isPartiallySupportedModel,
    online: Boolean(zendureDevice.online),
  };
}

module.exports = {
  convertDevice,
};
