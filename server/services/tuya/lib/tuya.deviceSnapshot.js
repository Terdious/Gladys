const { getDeviceType, getIgnoredCloudCodes, getLocalMapping, getProductIdFromDevice } = require('./mappings');
const { getLocalDpsFromCode } = require('./device/tuya.localMapping');
const { getParamValue } = require('./utils/tuya.deviceParams');
const { getLocalStatus } = require('./utils/tuya.degraded');
const { DEVICE_PARAM_NAME } = require('./utils/tuya.constants');
const logger = require('../../../utils/logger');

// The cloud model (specifications / thing model / shadow properties) is not persisted on Gladys
// devices: fetch it on demand and cache it so the 5s snapshot polling does not hammer the cloud.
const CLOUD_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

const getFeatureCodeFromExternalId = (externalId) => {
  const parts = String(externalId || '').split(':');
  return parts.length >= 2 ? parts[parts.length - 1] || null : null;
};

// Describe where a Tuya code lives in the device cloud model: its cloud label, the shadow dp_id and
// every section that declares it (specifications functions/status, thing model, shadow properties).
const describeCloudPath = (cloudModel, code) => {
  if (!cloudModel || !code) {
    return null;
  }
  const sources = [];
  let name = null;
  let dpId = null;
  let shadowValue;

  const specifications = cloudModel.specifications || {};
  (Array.isArray(specifications.functions) ? specifications.functions : []).forEach((entry) => {
    if (entry && entry.code === code) {
      sources.push('specifications.functions');
      name = name || entry.name;
    }
  });
  (Array.isArray(specifications.status) ? specifications.status : []).forEach((entry) => {
    if (entry && entry.code === code) {
      sources.push('specifications.status');
      name = name || entry.name;
    }
  });
  const services = Array.isArray(cloudModel.thing_model && cloudModel.thing_model.services)
    ? cloudModel.thing_model.services
    : [];
  services.forEach((service) => {
    (Array.isArray(service && service.properties) ? service.properties : []).forEach((property) => {
      if (property && property.code === code) {
        sources.push('thing_model');
        name = name || property.name;
        if (dpId === null && property.abilityId !== undefined) {
          dpId = property.abilityId;
        }
      }
    });
  });
  const shadowProperties = Array.isArray(cloudModel.properties && cloudModel.properties.properties)
    ? cloudModel.properties.properties
    : [];
  shadowProperties.forEach((property) => {
    if (property && property.code === code) {
      sources.push('shadow.properties');
      name = name || property.name;
      if (property.dp_id !== undefined) {
        dpId = property.dp_id;
      }
      shadowValue = property.value;
    }
  });

  if (sources.length === 0) {
    return null;
  }
  return { name: name || null, dp_id: dpId, sources, shadow_value: shadowValue };
};

const listCloudModelCodes = (cloudModel) => {
  const codes = new Set();
  if (!cloudModel) {
    return codes;
  }
  const specifications = cloudModel.specifications || {};
  [...(specifications.functions || []), ...(specifications.status || [])].forEach((entry) => {
    if (entry && entry.code) {
      codes.add(entry.code);
    }
  });
  (Array.isArray(cloudModel.thing_model && cloudModel.thing_model.services)
    ? cloudModel.thing_model.services
    : []
  ).forEach((service) => {
    (Array.isArray(service && service.properties) ? service.properties : []).forEach((property) => {
      if (property && property.code) {
        codes.add(property.code);
      }
    });
  });
  (Array.isArray(cloudModel.properties && cloudModel.properties.properties)
    ? cloudModel.properties.properties
    : []
  ).forEach((property) => {
    if (property && property.code) {
      codes.add(property.code);
    }
  });
  return codes;
};

const getCloudModel = async (self, topic) => {
  if (!self.deviceCloudModelCache) {
    self.deviceCloudModelCache = {};
  }
  const cached = self.deviceCloudModelCache[topic];
  if (cached && Date.now() - cached.at < CLOUD_MODEL_CACHE_TTL_MS) {
    return cached.model;
  }
  if (!self.connector || typeof self.connector.request !== 'function') {
    return cached ? cached.model : null;
  }
  try {
    const detailed = await self.loadDeviceDetails({ id: topic });
    const model = {
      specifications: detailed.specifications || {},
      properties: detailed.properties || {},
      thing_model: detailed.thing_model || null,
    };
    self.deviceCloudModelCache[topic] = { at: Date.now(), model };
    return model;
  } catch (e) {
    logger.warn(`[Tuya][snapshot] failed to load the cloud model for device=${topic}`, e);
    return cached ? cached.model : null;
  }
};

/**
 * @description Build a full debug snapshot of a Tuya device for the diagnostic page: supported
 * features (raw device input + cloud/local paths next to the transformed Gladys value), unsupported
 * codes (from the wire or the cloud model), ignored codes/DPS and connection state.
 * @param {string} selector - The Gladys device selector.
 * @returns {Promise<object>} The snapshot, or { error: 'not_found' } when the selector is unknown.
 * @example
 * const snapshot = await this.getDeviceSnapshot('tuya-device');
 */
async function getDeviceSnapshot(selector) {
  const device = this.gladys.stateManager.get('device', selector);
  if (!device) {
    return { error: 'not_found' };
  }
  const topic = String(device.external_id || '').split(':')[1] || null;
  const params = Array.isArray(device.params) ? device.params : [];
  const deviceType = device.device_type ? device.device_type : getDeviceType(device);
  const productId = getProductIdFromDevice(device);
  const ignoredCodes = getIgnoredCloudCodes(deviceType, productId);
  const localMapping = getLocalMapping(deviceType, productId);
  const rawValues = this.getRawValues(topic);
  const cloudModel = await getCloudModel(this, topic);

  const rawForCode = (code, dpsId, cloudPath) => {
    // Collect every memory hit (cloud keyed by code, local keyed by dps) and keep the FRESHEST one:
    // a stale cloud read must never mask the live local pushes of a persistent connection.
    const candidates = [];
    if (code && rawValues.codes[code]) {
      candidates.push(rawValues.codes[code]);
    }
    [...new Set([dpsId, cloudPath && cloudPath.dp_id].filter((id) => id !== null && id !== undefined))].forEach(
      (id) => {
        if (rawValues.dps[String(id)]) {
          candidates.push(rawValues.dps[String(id)]);
        }
      },
    );
    if (candidates.length > 0) {
      return candidates.sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    }
    if (cloudPath && cloudPath.shadow_value !== undefined) {
      return { value: cloudPath.shadow_value, origin: 'shadow', at: null };
    }
    return null;
  };

  const buildEntry = (code, extra = {}) => {
    const dpsId = code ? getLocalDpsFromCode(code, device) : null;
    const cloudPath = describeCloudPath(cloudModel, code);
    return {
      code,
      dps_id: dpsId,
      cloud: cloudPath ? { name: cloudPath.name, dp_id: cloudPath.dp_id, sources: cloudPath.sources } : null,
      raw: rawForCode(code, dpsId, cloudPath),
      ...extra,
    };
  };

  const seenCodes = new Set();
  const seenDps = new Set();
  const trackEntry = (entry) => {
    if (entry.code) {
      seenCodes.add(entry.code);
    }
    [entry.dps_id, entry.cloud && entry.cloud.dp_id].forEach((id) => {
      if (id !== null && id !== undefined) {
        seenDps.add(String(id));
      }
    });
    return entry;
  };

  const supported = (Array.isArray(device.features) ? device.features : []).map((feature) => {
    const code = getFeatureCodeFromExternalId(feature.external_id);
    return trackEntry(
      buildEntry(code, {
        selector: feature.selector,
        name: feature.name,
        category: feature.category,
        type: feature.type,
        unit: feature.unit,
        last_value: feature.last_value,
        last_value_string: feature.last_value_string,
        last_value_changed: feature.last_value_changed,
      }),
    );
  });

  const ignored = ignoredCodes.map((code) => trackEntry(buildEntry(code)));
  (Array.isArray(localMapping.ignoredDps) ? localMapping.ignoredDps : []).forEach((dpsId) => {
    if (!seenDps.has(String(dpsId))) {
      seenDps.add(String(dpsId));
      const raw = rawValues.dps[String(dpsId)] || null;
      ignored.push({ code: null, dps_id: dpsId, cloud: null, raw });
    }
  });

  // Unsupported: every cloud-model code not already supported/ignored, plus anything seen on the
  // wire (raw memory) that is not covered — raw input only, no Gladys value.
  const unsupported = [];
  listCloudModelCodes(cloudModel).forEach((code) => {
    if (!seenCodes.has(code)) {
      seenCodes.add(code);
      unsupported.push(trackEntry(buildEntry(code)));
    }
  });
  Object.keys(rawValues.codes).forEach((code) => {
    if (!seenCodes.has(code)) {
      seenCodes.add(code);
      unsupported.push(trackEntry(buildEntry(code)));
    }
  });
  Object.keys(rawValues.dps).forEach((dpsId) => {
    if (!seenDps.has(String(dpsId))) {
      seenDps.add(String(dpsId));
      unsupported.push({ code: null, dps_id: dpsId, cloud: null, raw: rawValues.dps[dpsId] });
    }
  });

  const persistentEntry = (this.persistentConnections && this.persistentConnections[topic]) || null;

  return {
    device: {
      name: device.name,
      selector: device.selector,
      external_id: device.external_id,
      device_type: deviceType,
      product_id: productId,
      protocol_version: getParamValue(params, DEVICE_PARAM_NAME.PROTOCOL_VERSION),
      ip_address: getParamValue(params, DEVICE_PARAM_NAME.IP_ADDRESS),
      local_override: getParamValue(params, DEVICE_PARAM_NAME.LOCAL_OVERRIDE),
      persistent_status: persistentEntry ? persistentEntry.status : null,
      persistent_last_data_at: persistentEntry && persistentEntry.lastDataAt ? persistentEntry.lastDataAt : null,
      degraded: getLocalStatus(this.degradedDevices, topic),
      cloud_model_loaded: Boolean(cloudModel),
    },
    supported,
    unsupported,
    ignored,
  };
}

module.exports = {
  CLOUD_MODEL_CACHE_TTL_MS,
  getDeviceSnapshot,
};
