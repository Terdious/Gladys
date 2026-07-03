import { Component } from 'preact';
import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';

import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../../../server/utils/constants';
import { RequestStatus } from '../../../../../utils/consts';
import style from './style.css';

const LOGS_POLL_INTERVAL_MS = 2000;
const SNAPSHOT_POLL_INTERVAL_MS = 5000;
const MAX_DISPLAYED_ENTRIES = 500;
const RAW_PREVIEW_LENGTH = 48;

const LEVEL_BADGE_CLASS = {
  debug: 'badge-secondary',
  info: 'badge-info',
  warn: 'badge-warning',
  error: 'badge-danger'
};

const LEVEL_ROW_CLASS = {
  warn: 'text-warning',
  error: 'text-danger'
};

const getTopicFromExternalId = externalId => {
  const parts = (externalId || '').split(':');
  return parts[0] === 'tuya' && parts[1] ? parts[1] : null;
};

const formatTime = ts => {
  const date = new Date(ts);
  return `${date.toLocaleTimeString()}.${String(date.getMilliseconds()).padStart(3, '0')}`;
};

const formatRawValue = raw => {
  if (!raw) {
    return null;
  }
  return typeof raw.value === 'string' ? raw.value : JSON.stringify(raw.value);
};

const copyToClipboard = async text => {
  if (!text) {
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fall through to the execCommand fallback below
    }
  }
  // navigator.clipboard only exists in secure contexts (HTTPS/localhost): a plain-HTTP LAN install
  // needs the legacy off-screen-textarea + execCommand fallback (same as the GitHub issue button).
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch (e) {
    return false;
  }
};

const CLOUD_SOURCE_LABELS = {
  'specifications.functions': 'spec.fn',
  'specifications.status': 'spec.st',
  thing_model: 'model',
  'shadow.properties': 'shadow'
};

const formatCloudPath = cloud => {
  if (!cloud) {
    return null;
  }
  const sources = (cloud.sources || []).map(source => CLOUD_SOURCE_LABELS[source] || source);
  const dp = cloud.dp_id !== null && cloud.dp_id !== undefined ? ` (dp ${cloud.dp_id})` : '';
  return `${cloud.name || '-'}${dp} [${sources.join(', ')}]`;
};

const snapshotEntryToText = entry => {
  const raw = formatRawValue(entry.raw);
  const cells = [
    entry.name || entry.code || `DP ${entry.dps_id}`,
    entry.code || '-',
    entry.dps_id !== null && entry.dps_id !== undefined ? entry.dps_id : '-',
    formatCloudPath(entry.cloud) || '-',
    entry.raw ? `${raw} (${entry.raw.origin})` : '-',
    entry.raw && entry.raw.at ? entry.raw.at : '-',
    entry.last_value_string !== undefined && entry.last_value_string !== null
      ? '<string state>'
      : entry.last_value !== undefined
      ? `${entry.last_value}${entry.unit ? ` ${entry.unit}` : ''}`
      : '-',
    entry.last_value_changed || '-'
  ];
  return `| ${cells.join(' | ')} |`;
};

class DiagnosticTab extends Component {
  state = {
    devices: [],
    selectedSelector: null,
    snapshot: null,
    entries: [],
    lastId: 0,
    levelFilter: 'all',
    textFilter: '',
    paused: false,
    devicesStatus: RequestStatus.Getting,
    cameraImage: null,
    copiedSnapshot: false,
    copiedLogs: false
  };

  async componentWillMount() {
    await this.getDevices();
    if (this.props.deviceSelector) {
      this.selectDevice(this.props.deviceSelector);
    }
    this.logsTimer = setInterval(this.pollDiagnostics, LOGS_POLL_INTERVAL_MS);
    this.snapshotTimer = setInterval(this.fetchSnapshot, SNAPSHOT_POLL_INTERVAL_MS);
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE, this.onNewState);
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STRING_STATE, this.onNewStringState);
  }

  componentWillUnmount() {
    clearInterval(this.logsTimer);
    clearInterval(this.snapshotTimer);
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE, this.onNewState);
    this.props.session.dispatcher.removeListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STRING_STATE,
      this.onNewStringState
    );
  }

  getDevices = async () => {
    this.setState({ devicesStatus: RequestStatus.Getting });
    try {
      const devices = await this.props.httpClient.get('/api/v1/service/tuya/device', {
        order_dir: 'asc'
      });
      this.setState({ devices, devicesStatus: RequestStatus.Success });
    } catch (e) {
      this.setState({ devicesStatus: RequestStatus.Error });
    }
  };

  getSelectedDevice = () => this.state.devices.find(device => device.selector === this.state.selectedSelector) || null;

  selectDevice = selector => {
    // Reset the stream so the log view only shows entries for the newly selected device.
    this.setState(
      { selectedSelector: selector || null, snapshot: null, entries: [], lastId: 0, cameraImage: null },
      () => {
        this.pollDiagnostics();
        this.fetchSnapshot();
      }
    );
  };

  handleDeviceChange = e => {
    this.selectDevice(e.target.value);
  };

  fetchSnapshot = async () => {
    const { selectedSelector } = this.state;
    if (!selectedSelector) {
      return;
    }
    try {
      const snapshot = await this.props.httpClient.get('/api/v1/service/tuya/device-snapshot', {
        selector: selectedSelector
      });
      // Defensive shape check: this debug page must never crash on an unexpected payload
      // (e.g. an older server without the endpoint, or an error response).
      if (snapshot && !snapshot.error && snapshot.device && Array.isArray(snapshot.supported)) {
        this.setState({ snapshot });
        this.refreshCameraImage(snapshot);
      }
    } catch (e) {
      // keep the previous snapshot; the next tick retries
    }
  };

  pollDiagnostics = async () => {
    if (this.state.paused) {
      return;
    }
    const selectedDevice = this.getSelectedDevice();
    const deviceId = selectedDevice ? getTopicFromExternalId(selectedDevice.external_id) : null;
    try {
      const options = { sinceId: this.state.lastId };
      if (deviceId) {
        options.deviceId = deviceId;
      }
      const { entries, lastId } = await this.props.httpClient.get('/api/v1/service/tuya/diagnostics', options);
      if (entries.length || lastId !== this.state.lastId) {
        this.setState(prevState => ({
          entries: [...prevState.entries, ...entries].slice(-MAX_DISPLAYED_ENTRIES),
          lastId
        }));
      }
    } catch (e) {
      // polling keeps retrying at the next tick
    }
  };

  onNewState = payload => {
    this.updateSnapshotFeature(payload.device_feature_selector, {
      last_value: payload.last_value,
      last_value_changed: payload.last_value_changed
    });
  };

  onNewStringState = payload => {
    this.updateSnapshotFeature(payload.device_feature, {
      last_value_string: payload.last_value_string,
      last_value_changed: payload.last_value_changed
    });
    const { snapshot } = this.state;
    if (snapshot && snapshot.device && payload.device === snapshot.device.selector) {
      this.refreshCameraImage(snapshot);
    }
  };

  updateSnapshotFeature = (featureSelector, fields) => {
    if (!featureSelector || !this.state.snapshot) {
      return;
    }
    this.setState(prevState => {
      if (
        !prevState.snapshot ||
        !Array.isArray(prevState.snapshot.supported) ||
        !prevState.snapshot.supported.some(entry => entry.selector === featureSelector)
      ) {
        return null;
      }
      return {
        snapshot: {
          ...prevState.snapshot,
          supported: prevState.snapshot.supported.map(entry =>
            entry.selector === featureSelector ? { ...entry, ...fields } : entry
          )
        }
      };
    });
  };

  refreshCameraImage = async snapshot => {
    const hasCameraFeature = (snapshot.supported || []).some(
      entry => entry.category === 'camera' && entry.type === 'image'
    );
    if (!hasCameraFeature) {
      return;
    }
    try {
      const cameraImage = await this.props.httpClient.get(`/api/v1/camera/${snapshot.device.selector}/image`);
      this.setState({ cameraImage });
    } catch (e) {
      this.setState({ cameraImage: null });
    }
  };

  setLevelFilter = e => {
    this.setState({ levelFilter: e.target.value });
  };

  setTextFilter = e => {
    this.setState({ textFilter: e.target.value });
  };

  togglePause = () => {
    this.setState(prevState => ({ paused: !prevState.paused }));
  };

  clearEntries = () => {
    this.setState({ entries: [] });
  };

  copyRawValue = async raw => {
    await copyToClipboard(formatRawValue(raw));
  };

  copySnapshot = async () => {
    const { snapshot } = this.state;
    if (!snapshot) {
      return;
    }
    const { device } = snapshot;
    const header =
      '| Feature | Code | Local DP | Cloud path | Raw input (origin) | Raw at | Gladys value | Last change |\n|---|---|---|---|---|---|---|---|';
    const lines = [
      `## Tuya device snapshot — ${device.name}`,
      '',
      `- selector: \`${device.selector}\` — external_id: \`${device.external_id}\``,
      `- device_type: \`${device.device_type}\` — product_id: \`${device.product_id}\``,
      `- protocol: ${device.protocol_version || '-'} — ip: ${device.ip_address || '-'} — local_override: ${
        device.local_override
      }`,
      `- persistent: ${device.persistent_status || 'none'} — degraded: ${
        device.degraded ? device.degraded.status : 'no'
      }`,
      '',
      '### Supported features',
      header,
      ...snapshot.supported.map(snapshotEntryToText),
      '',
      '### Unsupported (raw only)',
      header,
      ...snapshot.unsupported.map(snapshotEntryToText),
      '',
      '### Ignored',
      header,
      ...snapshot.ignored.map(snapshotEntryToText)
    ];
    const copied = await copyToClipboard(lines.join('\n'));
    this.setState({ copiedSnapshot: copied });
    setTimeout(() => this.setState({ copiedSnapshot: false }), 2000);
  };

  // Resolve a diagnostic entry's tuya device id to the real device name (falls back to the id).
  getDeviceLabel = deviceId => {
    if (!deviceId) {
      return null;
    }
    const device = this.state.devices.find(entry => getTopicFromExternalId(entry.external_id) === deviceId);
    return device ? `${device.name} (${deviceId})` : deviceId;
  };

  copyLogs = async () => {
    const text = this.getVisibleEntries()
      .map(
        entry =>
          `${entry.ts} [${entry.level}]${entry.device_id ? ` [${this.getDeviceLabel(entry.device_id)}]` : ''} [${
            entry.event
          }] ${entry.message}${entry.data ? ` ${entry.data}` : ''}`
      )
      .join('\n');
    const copied = await copyToClipboard(text);
    this.setState({ copiedLogs: copied });
    setTimeout(() => this.setState({ copiedLogs: false }), 2000);
  };

  getVisibleEntries = () => {
    const { entries, levelFilter, textFilter } = this.state;
    const lowerText = textFilter.trim().toLowerCase();
    // Newest first.
    return [...entries].reverse().filter(entry => {
      if (levelFilter !== 'all' && entry.level !== levelFilter) {
        return false;
      }
      if (
        lowerText &&
        !`${entry.event} ${entry.message} ${entry.data || ''} ${this.getDeviceLabel(entry.device_id) || ''}`
          .toLowerCase()
          .includes(lowerText)
      ) {
        return false;
      }
      return true;
    });
  };

  renderRawCell = entry => {
    const raw = formatRawValue(entry.raw);
    if (raw === null) {
      return <td class="text-muted">-</td>;
    }
    return (
      <td class={style.featureValue}>
        <span title={raw}>{raw.length > RAW_PREVIEW_LENGTH ? `${raw.slice(0, RAW_PREVIEW_LENGTH)}…` : raw}</span>
        <button
          class="btn btn-sm btn-link p-0 ml-1"
          onClick={() => this.copyRawValue(entry.raw)}
          title={`${entry.raw.origin} — ${entry.raw.at}`}
        >
          <i class="fe fe-copy" />
        </button>
        <span class="badge badge-outline ml-1">{entry.raw.origin}</span>
        {entry.raw.at && <div class="text-muted small">{formatTime(entry.raw.at)}</div>}
      </td>
    );
  };

  renderGladysValueCell = entry => {
    if (entry.category === 'camera' && entry.type === 'image') {
      return (
        <td>
          {this.state.cameraImage ? (
            <img class={style.cameraThumbnail} src={`data:${this.state.cameraImage}`} alt="camera" />
          ) : (
            <span class="text-muted">
              <Text id="integration.tuya.diagnostic.noImage" />
            </span>
          )}
        </td>
      );
    }
    if (entry.last_value_string !== undefined && entry.last_value_string !== null) {
      return <td class={style.featureValue}>{`${String(entry.last_value_string).slice(0, RAW_PREVIEW_LENGTH)}…`}</td>;
    }
    if (entry.last_value === undefined) {
      return <td class="text-muted">-</td>;
    }
    return (
      <td class={style.featureValue}>
        {entry.last_value}
        {entry.unit ? ` ${entry.unit}` : ''}
      </td>
    );
  };

  // All three sections share the exact same columns (with fixed widths) so they stay vertically
  // aligned; sections without a Gladys value simply show dashes.
  renderSnapshotSection = (titleId, sectionEntries) => (
    <div>
      <h4 class="mt-4">
        <Text id={titleId} /> <span class="badge badge-secondary">{sectionEntries.length}</span>
      </h4>
      {sectionEntries.length === 0 ? (
        <div class="text-muted mb-2">
          <Text id="integration.tuya.diagnostic.emptySection" />
        </div>
      ) : (
        <div class="table-responsive">
          <table class={cx('table table-sm table-hover table-outline table-vcenter card-table', style.snapshotTable)}>
            <thead>
              <tr>
                <th class={style.colName}>
                  <Text id="integration.tuya.diagnostic.featureName" />
                </th>
                <th class={style.colCode}>
                  <Text id="integration.tuya.diagnostic.colCode" />
                </th>
                <th class={style.colDp}>
                  <Text id="integration.tuya.diagnostic.colLocal" />
                </th>
                <th class={style.colCloud}>
                  <Text id="integration.tuya.diagnostic.colCloud" />
                </th>
                <th class={style.colRaw}>
                  <Text id="integration.tuya.diagnostic.colRaw" />
                </th>
                <th class={style.colValue}>
                  <Text id="integration.tuya.diagnostic.colGladysValue" />
                </th>
                <th class={style.colChanged}>
                  <Text id="integration.tuya.diagnostic.featureLastChanged" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sectionEntries.map(entry => (
                <tr>
                  <td>{entry.name || <span class="text-muted">-</span>}</td>
                  <td>
                    <code>{entry.code || '-'}</code>
                  </td>
                  <td>{entry.dps_id !== null && entry.dps_id !== undefined ? entry.dps_id : '-'}</td>
                  <td>
                    {entry.cloud ? (
                      <span title={formatCloudPath(entry.cloud)}>
                        {entry.cloud.name || '-'}
                        {entry.cloud.dp_id !== null && entry.cloud.dp_id !== undefined && (
                          <span class="text-muted"> (dp {entry.cloud.dp_id})</span>
                        )}
                        <div>
                          {(entry.cloud.sources || []).map(source => (
                            <span class="badge badge-outline mr-1">{CLOUD_SOURCE_LABELS[source] || source}</span>
                          ))}
                        </div>
                      </span>
                    ) : (
                      <span class="text-muted">-</span>
                    )}
                  </td>
                  {this.renderRawCell(entry)}
                  {this.renderGladysValueCell(entry)}
                  <td>{entry.last_value_changed ? formatTime(entry.last_value_changed) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  render(
    {},
    { devices, selectedSelector, snapshot, levelFilter, textFilter, paused, devicesStatus, copiedSnapshot, copiedLogs }
  ) {
    const visibleEntries = this.getVisibleEntries();
    return (
      <div>
        <div class="card">
          <div class="card-header">
            <h1 class="card-title">
              <Text id="integration.tuya.diagnostic.title" />
            </h1>
          </div>
          <div class="card-body">
            <div class="alert alert-secondary">
              <Text id="integration.tuya.diagnostic.description" />
            </div>
            <div
              class={cx('dimmer', {
                active: devicesStatus === RequestStatus.Getting
              })}
            >
              <div class="dimmer-content">
                <div class="form-group">
                  <label class="form-label">
                    <Text id="integration.tuya.diagnostic.deviceLabel" />
                  </label>
                  <select class="form-control" value={selectedSelector || ''} onChange={this.handleDeviceChange}>
                    <option value="">
                      <Text id="integration.tuya.diagnostic.allDevices" />
                    </option>
                    {devices.map(device => (
                      <option value={device.selector}>{device.name}</option>
                    ))}
                  </select>
                </div>
                {snapshot && snapshot.device && (
                  <div class="text-muted small">
                    <code>{snapshot.device.external_id}</code>
                    {' · '}
                    <Text id="integration.tuya.diagnostic.infoProtocol" /> {snapshot.device.protocol_version || '-'}
                    {' · IP '}
                    {snapshot.device.ip_address || '-'}
                    {' · '}
                    <Text id="integration.tuya.diagnostic.infoPersistent" />{' '}
                    <span
                      class={cx('badge', {
                        'badge-success': snapshot.device.persistent_status === 'connected',
                        'badge-warning':
                          snapshot.device.persistent_status && snapshot.device.persistent_status !== 'connected',
                        'badge-secondary': !snapshot.device.persistent_status
                      })}
                    >
                      {snapshot.device.persistent_status || 'none'}
                    </span>
                    {' · '}
                    <Text id="integration.tuya.diagnostic.infoDegraded" />{' '}
                    <span class={cx('badge', snapshot.device.degraded ? 'badge-danger' : 'badge-success')}>
                      {snapshot.device.degraded ? snapshot.device.degraded.status : 'ok'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {snapshot && snapshot.device && (
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                <Text id="integration.tuya.diagnostic.featuresTitle" />
              </h3>
              <div class="card-options">
                <button class="btn btn-sm btn-outline-primary" onClick={this.copySnapshot}>
                  {copiedSnapshot ? (
                    <Text id="integration.tuya.diagnostic.copied" />
                  ) : (
                    <Text id="integration.tuya.diagnostic.copyContent" />
                  )}
                </button>
              </div>
            </div>
            <div class="card-body pt-0">
              {this.renderSnapshotSection('integration.tuya.diagnostic.supportedTitle', snapshot.supported)}
              {this.renderSnapshotSection('integration.tuya.diagnostic.unsupportedTitle', snapshot.unsupported)}
              {this.renderSnapshotSection('integration.tuya.diagnostic.ignoredTitle', snapshot.ignored)}
            </div>
          </div>
        )}

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <Text id="integration.tuya.diagnostic.logsTitle" />
            </h3>
            <div class="card-options">
              <button class="btn btn-sm btn-outline-primary" onClick={this.copyLogs}>
                {copiedLogs ? (
                  <Text id="integration.tuya.diagnostic.copied" />
                ) : (
                  <Text id="integration.tuya.diagnostic.copyContent" />
                )}
              </button>
            </div>
          </div>
          <div class={cx('card-body border-bottom py-3', style.logToolbar)}>
            <select class="form-control form-control-sm" value={levelFilter} onChange={this.setLevelFilter}>
              <option value="all">
                <Text id="integration.tuya.diagnostic.levelAll" />
              </option>
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
            <Localizer>
              <input
                class="form-control form-control-sm"
                type="text"
                value={textFilter}
                onInput={this.setTextFilter}
                placeholder={<Text id="integration.tuya.diagnostic.textFilterPlaceholder" />}
              />
            </Localizer>
            <button class={cx('btn btn-sm', paused ? 'btn-success' : 'btn-outline-warning')} onClick={this.togglePause}>
              {paused ? (
                <Text id="integration.tuya.diagnostic.resume" />
              ) : (
                <Text id="integration.tuya.diagnostic.pause" />
              )}
            </button>
            <button class="btn btn-sm btn-outline-danger" onClick={this.clearEntries}>
              <Text id="integration.tuya.diagnostic.clear" />
            </button>
          </div>
          <div class={cx('card-body', style.logContainer)}>
            {visibleEntries.length === 0 && (
              <div class="text-muted">
                <Text id="integration.tuya.diagnostic.noLogs" />
              </div>
            )}
            {visibleEntries.map(entry => (
              <div class={cx(style.logRow, LEVEL_ROW_CLASS[entry.level])}>
                <span class="text-muted mr-2">{formatTime(entry.ts)}</span>
                <span class={cx('badge mr-2', LEVEL_BADGE_CLASS[entry.level])}>{entry.level}</span>
                {entry.device_id && (
                  <span class="badge badge-primary mr-2" title={entry.device_id}>
                    {this.getDeviceLabel(entry.device_id)}
                  </span>
                )}
                <span class="badge badge-outline mr-2">{entry.event}</span>
                <span>{entry.message}</span>
                {entry.data && <pre class={style.logData}>{entry.data}</pre>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

export default DiagnosticTab;
