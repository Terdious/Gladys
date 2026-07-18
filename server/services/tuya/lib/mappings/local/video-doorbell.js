// Wifi video doorbell (Tuya category "sp") — local mapping.
// DP ids are taken from the device thing_model (abilityId == dp_id, confirmed against the shadow
// properties). Only the writable boolean settings exposed by the cloud mapping are resolved here;
// the deferred codes' DPS are listed in ignoredDps.
// NB: these P2P doorbells may not answer the local protocol (local poll can time out); the mapping
// is correct per the device model and used as soon as a unit responds locally.
module.exports = {
  strict: true,
  // Runtime-observed (i5e3a4qxcsthszin): the doorbell rejects every local query format
  // (DP_QUERY/DP_REFRESH/null-SET answer 'parse data error' or time out, and an initial
  // encrypted query makes it drop a 3.3 socket) but PUSHES 3.3-framed status on an idle
  // socket at ring/motion time. Local mode is therefore listen-only: connect without any
  // initial/periodic query and let the pushes come; commands go straight to cloud.
  listenOnly: true,
  ignoredDps: ['106', '108', '109', '110', '111', '115', '117', '151', '154', '160'],
  codeAliases: {},
  dps: {
    basic_indicator: 101,
    basic_flip: 103,
    basic_osd: 104,
    motion_switch: 134,
    doorbell_active: 136,
    record_switch: 150,
  },
};
