module.exports = {
  name: 'Vanne Brumisateur',
  convertDevice: {
    input: './input-device.json',
    expected: './expected-device.json',
  },
  pollCloud: {
    device: './poll-device.json',
    response: './cloud-status.json',
    expectedEvents: './expected-events.json',
  },
  localMapping: {
    device: './poll-device.json',
    expected: './expected-local-mapping.json',
  },
};
