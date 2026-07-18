module.exports = {
  name: 'video doorbell cloud settings',
  convertDevice: {
    input: './input-device.json',
    expected: './expected-device.json',
  },
  pollCloud: {
    device: './poll-device.json',
    response: './cloud-status.json',
    expectedEvents: './expected-cloud-events.json',
  },
  pollLocal: {
    device: './poll-device.json',
    dps: './local-dps.json',
    expectedEvents: './expected-local-events.json',
    expectedCloudRequests: 0,
  },
  localMapping: {
    device: './poll-device.json',
    expected: './expected-local-mapping.json',
  },
  setValueLocal: {
    device: './poll-device.json',
    featureExternalId: 'tuya:bf0e59548489fcb4ea62of:motion_switch',
    inputValue: 1,
    // Listen-only local channel (device22): the doorbell never acknowledges a local SET, so the
    // command goes straight to cloud without attempting the doomed local writes.
    expectedLocalSet: null,
    expectedCloudRequests: 1,
  },
};
