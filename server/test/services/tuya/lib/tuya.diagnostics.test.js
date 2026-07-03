const { expect } = require('chai');

const {
  DIAGNOSTICS_MAX_ENTRIES,
  DIAGNOSTICS_MAX_DATA_LENGTH,
  recordDiagnostic,
  getDiagnostics,
} = require('../../../../services/tuya/lib/tuya.diagnostics');

const buildSelf = () => {
  const self = {};
  self.recordDiagnostic = recordDiagnostic;
  self.getDiagnostics = getDiagnostics;
  return self;
};

describe('Tuya diagnostics collector', () => {
  it('records structured entries with incrementing ids and returns them', () => {
    const self = buildSelf();
    self.recordDiagnostic('info', 'device-1', 'persistent_connected', 'connected');
    self.recordDiagnostic('warn', 'device-2', 'local_poll_failed', 'timeout', { detail: 'x' });

    const { entries, lastId } = self.getDiagnostics();
    expect(lastId).to.equal(2);
    expect(entries).to.have.length(2);
    expect(entries[0]).to.include({ id: 1, level: 'info', device_id: 'device-1', event: 'persistent_connected' });
    expect(entries[0].ts).to.be.a('string');
    expect(entries[0].data).to.equal(undefined);
    expect(entries[1].data).to.equal('{"detail":"x"}');
  });

  it('coerces unknown levels to info and null device ids', () => {
    const self = buildSelf();
    self.recordDiagnostic('verbose', null, 'startup', 'service started');

    const { entries } = self.getDiagnostics();
    expect(entries[0].level).to.equal('info');
    expect(entries[0].device_id).to.equal(null);
  });

  it('truncates oversized data payloads and keeps string data as-is', () => {
    const self = buildSelf();
    self.recordDiagnostic('debug', 'device-1', 'push_dps', 'big', 'a'.repeat(DIAGNOSTICS_MAX_DATA_LENGTH + 100));
    self.recordDiagnostic('debug', 'device-1', 'push_dps', 'small', 'raw-string');

    const { entries } = self.getDiagnostics();
    expect(entries[0].data).to.have.length.below(DIAGNOSTICS_MAX_DATA_LENGTH + 30);
    expect(entries[0].data.endsWith('... (truncated)')).to.equal(true);
    expect(entries[1].data).to.equal('raw-string');
  });

  it('serializes non-stringifiable data via String()', () => {
    const self = buildSelf();
    const circular = {};
    circular.self = circular;
    self.recordDiagnostic('debug', 'device-1', 'push_dps', 'circular', circular);

    const { entries } = self.getDiagnostics();
    expect(entries[0].data).to.equal('[object Object]');
  });

  it('caps the ring buffer to the max entries (oldest dropped, ids keep growing)', () => {
    const self = buildSelf();
    for (let i = 0; i < DIAGNOSTICS_MAX_ENTRIES + 10; i += 1) {
      self.recordDiagnostic('debug', 'device-1', 'poll_summary', `entry ${i}`);
    }

    const { entries, lastId } = self.getDiagnostics();
    expect(entries).to.have.length(DIAGNOSTICS_MAX_ENTRIES);
    expect(lastId).to.equal(DIAGNOSTICS_MAX_ENTRIES + 10);
    expect(entries[0].id).to.equal(11);
  });

  it('filters by device, minimum level and sinceId', () => {
    const self = buildSelf();
    self.recordDiagnostic('debug', 'device-1', 'poll_summary', 'd1 debug');
    self.recordDiagnostic('warn', 'device-1', 'local_poll_failed', 'd1 warn');
    self.recordDiagnostic('error', 'device-2', 'cloud_poll_failed', 'd2 error');
    self.recordDiagnostic('info', null, 'startup', 'service-wide');

    expect(self.getDiagnostics({ deviceId: 'device-1' }).entries.map((e) => e.message)).to.deep.equal([
      'd1 debug',
      'd1 warn',
    ]);
    expect(self.getDiagnostics({ level: 'warn' }).entries.map((e) => e.message)).to.deep.equal(['d1 warn', 'd2 error']);
    expect(self.getDiagnostics({ deviceId: 'device-1', level: 'error' }).entries).to.deep.equal([]);
    expect(self.getDiagnostics({ sinceId: 2 }).entries.map((e) => e.id)).to.deep.equal([3, 4]);
    expect(self.getDiagnostics({ sinceId: 'not-a-number' }).entries).to.have.length(4);
  });

  it('returns an empty result on a handler that never recorded', () => {
    const self = buildSelf();
    expect(self.getDiagnostics()).to.deep.equal({ entries: [], lastId: 0 });
  });
});

describe('Tuya raw-value memory', () => {
  const {
    RAW_VALUE_MAX_LENGTH,
    recordRawValues,
    getRawValues,
    // eslint-disable-next-line global-require
  } = require('../../../../services/tuya/lib/tuya.diagnostics');

  const buildRawSelf = () => {
    const self = {};
    self.recordRawValues = recordRawValues;
    self.getRawValues = getRawValues;
    return self;
  };

  it('remembers the last raw value per dps and per code with origin and timestamp', () => {
    const self = buildRawSelf();
    self.recordRawValues('device-1', 'local_push', { 1: true, 136: 'ring' }, 'dps');
    self.recordRawValues('device-1', 'cloud', { doorbell_active: 'ring' }, 'codes');
    self.recordRawValues('device-1', 'local_poll', { 1: false }, 'dps');

    const raw = self.getRawValues('device-1');
    expect(raw.dps['1']).to.include({ value: false, origin: 'local_poll' });
    expect(raw.dps['136']).to.include({ value: 'ring', origin: 'local_push' });
    expect(raw.codes.doorbell_active).to.include({ value: 'ring', origin: 'cloud' });
    expect(raw.dps['1'].at).to.be.a('string');
  });

  it('truncates oversized string raw values', () => {
    const self = buildRawSelf();
    self.recordRawValues('device-1', 'local_push', { 154: 'a'.repeat(RAW_VALUE_MAX_LENGTH + 50) }, 'dps');
    const raw = self.getRawValues('device-1');
    expect(raw.dps['154'].value.endsWith('... (truncated)')).to.equal(true);
  });

  it('is a no-op on missing topic or values and returns empty maps by default', () => {
    const self = buildRawSelf();
    self.recordRawValues(null, 'cloud', { a: 1 }, 'codes');
    self.recordRawValues('device-1', 'cloud', null, 'codes');
    expect(self.getRawValues('device-1')).to.deep.equal({ dps: {}, codes: {} });
    expect(self.getRawValues('unknown')).to.deep.equal({ dps: {}, codes: {} });
  });
});
