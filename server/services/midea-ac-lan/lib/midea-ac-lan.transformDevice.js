const { addSelector } = require('../../../utils/addSelector');
const { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } = require('../../../utils/constants');

const PARAMS = {
    MIDEA_ID: 'MIDEA_ID',
    MIDEA_HOST: 'MIDEA_HOST',
    MIDEA_PORT: 'MIDEA_PORT',
    MIDEA_KEY: 'MIDEA_KEY',
    MIDEA_TOKEN: 'MIDEA_TOKEN',
    MIDEA_MODEL: 'MIDEA_MODEL',
    MIDEA_TYPE: 'MIDEA_TYPE',
    MIDEA_FW: 'MIDEA_FW',
    MIDEA_SUBTYPE: 'MIDEA_SUBTYPE',
    MIDEA_UDPID: 'MIDEA_UDPID'
};

const buildPowerFeature = (deviceExternalId) => {
    const feature = {
        name: 'Power',
        external_id: `${deviceExternalId}:binary`,
        selector: `${deviceExternalId}:binary`,
        category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
        type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true
    };
    addSelector(feature);
    return feature;
};

const buildTargetTemperatureFeature = (deviceExternalId) => {
    const feature = {
        name: 'Target temperature',
        external_id: `${deviceExternalId}:target-temperature`,
        selector: `${deviceExternalId}:target-temperature`,
        category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
        type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE,
        unit: 'celsius',
        min: 16,
        max: 31,
        read_only: false,
        has_feedback: false,
        keep_history: true
    };
    addSelector(feature);
    return feature;
};

const buildModeFeature = (deviceExternalId) => {
    const feature = {
        name: 'Mode',
        external_id: `${deviceExternalId}:mode`,
        selector: `${deviceExternalId}:mode`,
        category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
        type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.MODE,
        min: 0,
        max: 0,
        read_only: false,
        has_feedback: false,
        keep_history: true
    };
    addSelector(feature);
    return feature;
};

const buildRoomTemperatureFeature = (deviceExternalId) => {
    const feature = {
        name: 'Room temperature',
        external_id: `${deviceExternalId}:temperature`,
        selector: `${deviceExternalId}:temperature`,
        category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
        type: DEVICE_FEATURE_TYPES.TEMPERATURE_SENSOR.MIN,
        unit: 'celsius',
        min: -50,
        max: 100,
        read_only: true,
        has_feedback: false,
        keep_history: true
    };
    addSelector(feature);
    return feature;
};

/**
 * @description Transform Midea device to Gladys device.
 * @param {object} device - Midea device.
 * @param {string} serviceId - Service ID.
 * @returns {object} Return Gladys device.
 * @example
 * const gladysDevice = transformDevice({ id: '...', host: '...', model: '...' }, serviceId);
 */
function transformDevice(device, serviceId) {
    const { id, host, port, model, type, fw, subtype, udpId, key, token, name } = device;
    const deviceExternalId = `midea-ac-lan:${id}`;

    const params = [
        {
            name: PARAMS.MIDEA_ID,
            value: id
        },
        {
            name: PARAMS.MIDEA_HOST,
            value: host
        },
        {
            name: PARAMS.MIDEA_PORT,
            value: port || 6444
        },
        {
            name: PARAMS.MIDEA_KEY,
            value: key
        },
        {
            name: PARAMS.MIDEA_TOKEN,
            value: token
        },
        {
            name: PARAMS.MIDEA_MODEL,
            value: model
        },
        {
            name: PARAMS.MIDEA_TYPE,
            value: type
        },
        {
            name: PARAMS.MIDEA_FW,
            value: fw
        },
        {
            name: PARAMS.MIDEA_SUBTYPE,
            value: subtype
        },
        {
            name: PARAMS.MIDEA_UDPID,
            value: udpId
        }
    ];

    const gladysDevice = {
        name: name || `Midea ${model}`,
        model: model,
        service_id: serviceId,
        external_id: deviceExternalId,
        selector: deviceExternalId,
        features: [
            buildPowerFeature(deviceExternalId),
            buildTargetTemperatureFeature(deviceExternalId),
            buildModeFeature(deviceExternalId),
            buildRoomTemperatureFeature(deviceExternalId)
        ],
        params
    };

    addSelector(gladysDevice);
    return gladysDevice;
}

module.exports = {
    transformDevice,
};
