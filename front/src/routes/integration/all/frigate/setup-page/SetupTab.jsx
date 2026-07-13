import { Component } from 'preact';
import { Text, MarkupText, Localizer } from 'preact-i18n';
import { RequestStatus } from '../../../../../utils/consts';
import CheckStatus from './CheckStatus.js';
import classNames from 'classnames/bind';
import style from './style.css';
import get from 'get-value';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../../../server/utils/constants';
import config from '../../../../../config';

let cx = classNames.bind(style);

class SetupTab extends Component {
  componentDidMount = () => {
    this.checkStatus();
  };

  async componentWillMount() {
    this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.FRIGATE.STATUS_CHANGE, this.checkStatus);
  }

  componentWillUnmount = () => {
    this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.FRIGATE.STATUS_CHANGE, this.checkStatus);
    if (this.showPasswordTimer) {
      clearTimeout(this.showPasswordTimer);
      this.showPasswordTimer = null;
    }
  };

  getAdminCredentials = async () => {
    try {
      const passwordVariable = await this.props.httpClient.get(
        '/api/v1/service/frigate/variable/FRIGATE_ADMIN_PASSWORD'
      );
      this.setState({ frigateAdminPassword: passwordVariable.value });
    } catch (e) {
      // Password not configured yet
      this.setState({ frigateAdminPassword: null });
    }
  };

  togglePassword = () => {
    const { showPassword } = this.state;

    if (this.showPasswordTimer) {
      clearTimeout(this.showPasswordTimer);
      this.showPasswordTimer = null;
    }

    this.setState({ showPassword: !showPassword });

    if (!showPassword) {
      this.showPasswordTimer = setTimeout(() => this.setState({ showPassword: false }), 5000);
    }
  };

  checkStatus = async () => {
    let frigateStatus = {
      dockerBased: false,
      networkModeValid: false,
      frigateEnabled: false,
      mqttExist: false,
      mqttRunning: false,
      frigateExist: false,
      frigateRunning: false,
      gladysConnected: false,
      frigateConnected: false,
      vaapiAvailable: false,
      mqttPort: null,
      frigateUiPort: null,
      frigateApiPort: null,
      frigateRtspPort: null
    };
    try {
      frigateStatus = await this.props.httpClient.get('/api/v1/service/frigate/status');
    } finally {
      let frigateUrl = null;
      const isGladysPlus = this.props.session.gatewayClient !== undefined;
      if (!isGladysPlus && frigateStatus.frigateUiPort) {
        const url = new URL(config.localApiUrl);
        frigateUrl = `https://${url.hostname}:${frigateStatus.frigateUiPort}`;
      }
      this.setState({
        dockerBased: frigateStatus.dockerBased,
        networkModeValid: frigateStatus.networkModeValid,
        frigateEnabled: frigateStatus.frigateEnabled,
        mqttExist: frigateStatus.mqttExist,
        mqttRunning: frigateStatus.mqttRunning,
        frigateExist: frigateStatus.frigateExist,
        frigateRunning: frigateStatus.frigateRunning,
        gladysConnected: frigateStatus.gladysConnected,
        frigateConnected: frigateStatus.frigateConnected,
        vaapiAvailable: frigateStatus.vaapiAvailable,
        mqttPort: frigateStatus.mqttPort,
        frigateUiPort: frigateStatus.frigateUiPort,
        frigateApiPort: frigateStatus.frigateApiPort,
        frigateRtspPort: frigateStatus.frigateRtspPort,
        frigateUrl
      });
      if (frigateStatus.frigateEnabled) {
        await this.getRetentionSettings();
      }
      if (frigateStatus.frigateConnected) {
        await this.getAdminCredentials();
        await this.getStorage();
      }
    }
  };

  getStorage = async () => {
    try {
      const frigateStats = await this.props.httpClient.get('/api/v1/service/frigate/stats');
      // Frigate stats expose storage either under service.storage or storage,
      // keyed by mount path: 0.17 reports per sub-folder (/media/frigate/recordings...)
      const storageRoot =
        frigateStats && ((frigateStats.service && frigateStats.service.storage) || frigateStats.storage);
      let recordingsStorage = null;
      if (storageRoot) {
        const storageKey = Object.keys(storageRoot).find(mountPath => mountPath.startsWith('/media/frigate'));
        recordingsStorage =
          storageRoot['/media/frigate/recordings'] ||
          storageRoot['/media/frigate'] ||
          (storageKey ? storageRoot[storageKey] : null);
      }
      this.setState({ recordingsStorage });
    } catch (e) {
      this.setState({ recordingsStorage: null });
    }
  };

  getRetentionSettings = async () => {
    // Never overwrite a value the user is editing
    if (this.state.retentionLoaded) {
      return;
    }
    const loadDays = async (key, fallback) => {
      try {
        const variable = await this.props.httpClient.get(`/api/v1/service/frigate/variable/${key}`);
        const parsed = parseInt(variable.value, 10);
        return Number.isNaN(parsed) || parsed < 0 ? fallback : parsed;
      } catch (e) {
        return fallback;
      }
    };
    const recordContinuousDays = await loadDays('FRIGATE_RECORD_CONTINUOUS_DAYS', 2);
    const recordAlertsDays = await loadDays('FRIGATE_RECORD_ALERTS_DAYS', 7);
    const recordDetectionsDays = await loadDays('FRIGATE_RECORD_DETECTIONS_DAYS', 7);
    this.setState({
      recordContinuousDays,
      recordAlertsDays,
      recordDetectionsDays,
      retentionLoaded: true
    });
  };

  updateRetention = field => e => {
    this.setState({ [field]: e.target.value, retentionStatus: null });
  };

  saveRetention = async () => {
    this.setState({ retentionStatus: RequestStatus.Getting });
    try {
      const { recordContinuousDays, recordAlertsDays, recordDetectionsDays } = this.state;
      await this.props.httpClient.post('/api/v1/service/frigate/variable/FRIGATE_RECORD_CONTINUOUS_DAYS', {
        value: recordContinuousDays
      });
      await this.props.httpClient.post('/api/v1/service/frigate/variable/FRIGATE_RECORD_ALERTS_DAYS', {
        value: recordAlertsDays
      });
      await this.props.httpClient.post('/api/v1/service/frigate/variable/FRIGATE_RECORD_DETECTIONS_DAYS', {
        value: recordDetectionsDays
      });
      // Regenerate the Frigate configuration (only restarts Frigate when it changed)
      await this.props.httpClient.post('/api/v1/service/frigate/config/apply');
      this.setState({ retentionStatus: RequestStatus.Success });
      await this.getStorage();
    } catch (e) {
      console.error(e);
      this.setState({ retentionStatus: RequestStatus.Error });
    }
  };

  startContainers = async () => {
    let error = false;
    this.setState({
      frigateStatus: RequestStatus.Getting,
      pendingAction: 'enable'
    });

    try {
      await this.props.httpClient.post('/api/v1/service/frigate/connect');
    } catch (e) {
      error = error | get(e, 'response.status');
    }

    if (error) {
      this.setState({
        frigateStatus: RequestStatus.Error
      });
    } else {
      this.setState({
        frigateStatus: RequestStatus.Success
      });
    }
    await this.checkStatus();
  };

  stopContainers = async () => {
    let error = false;
    this.setState({
      frigateStatus: RequestStatus.Getting,
      pendingAction: 'disable'
    });

    try {
      await this.props.httpClient.post('/api/v1/service/frigate/disconnect');
    } catch (e) {
      error = error | get(e, 'response.status');
    }

    if (error) {
      this.setState({
        frigateStatus: RequestStatus.Error
      });
    } else {
      this.setState({
        frigateStatus: RequestStatus.Success
      });
    }
    this.setState({ showConfirmDisable: false });
    await this.checkStatus();
  };

  showConfirmDisable = () => {
    this.setState({ showConfirmDisable: true });
  };

  cancelDisable = () => {
    this.setState({ showConfirmDisable: false });
  };

  render(
    props,
    {
      dockerBased,
      networkModeValid,
      frigateEnabled,
      mqttRunning,
      frigateExist,
      frigateRunning,
      gladysConnected,
      frigateConnected,
      vaapiAvailable,
      mqttPort,
      frigateUiPort,
      frigateApiPort,
      frigateRtspPort,
      frigateUrl,
      frigateStatus,
      pendingAction,
      showConfirmDisable,
      frigateAdminPassword,
      showPassword,
      recordingsStorage,
      recordContinuousDays,
      recordAlertsDays,
      recordDetectionsDays,
      retentionStatus
    }
  ) {
    const usedPercent = recordingsStorage
      ? Math.min(100, Math.round((recordingsStorage.used / recordingsStorage.total) * 100))
      : 0;
    const retentionValid = [recordContinuousDays, recordAlertsDays, recordDetectionsDays].every(
      days => days !== '' && days !== null && days !== undefined && Number(days) >= 0
    );
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.frigate.setup.title" />
          </h1>
        </div>
        <div class="card-body">
          <p>
            <MarkupText id="integration.frigate.setup.description" />
          </p>

          <CheckStatus
            frigateEnabled={frigateEnabled}
            frigateExist={frigateExist}
            frigateRunning={frigateRunning}
            dockerBased={dockerBased}
            networkModeValid={networkModeValid}
            frigateStatus={frigateStatus}
            pendingAction={pendingAction}
          />

          {dockerBased && networkModeValid && !frigateEnabled && !showConfirmDisable && (
            <button
              onClick={this.startContainers}
              class="btn btn-primary"
              disabled={frigateStatus === RequestStatus.Getting}
            >
              <Text id="integration.frigate.setup.enableFrigate" />
            </button>
          )}
          {dockerBased && networkModeValid && frigateEnabled && !showConfirmDisable && (
            <button
              onClick={this.showConfirmDisable}
              class="btn btn-danger"
              disabled={frigateStatus === RequestStatus.Getting}
            >
              <Text id="integration.frigate.setup.disableFrigate" />
            </button>
          )}
          {dockerBased && networkModeValid && frigateEnabled && showConfirmDisable && (
            <div
              class={cx(
                'd-flex',
                'justify-content-between',
                'align-items-start',
                'flex-column',
                style.confirmDisableContainer
              )}
            >
              <div class="alert alert-warning">
                <Text id="integration.frigate.setup.confirmDisableWarning" />
              </div>
              <Text id="integration.frigate.setup.confirmDisableLabel" />
              <div>
                <button
                  onClick={this.stopContainers}
                  className="btn btn-danger"
                  disabled={frigateStatus === RequestStatus.Getting}
                >
                  <Text id="integration.frigate.setup.disableFrigate" />
                </button>
                <button
                  onClick={this.cancelDisable}
                  className="btn ml-2"
                  disabled={frigateStatus === RequestStatus.Getting}
                >
                  <Text id="integration.frigate.setup.confirmDisableCancelButton" />
                </button>
              </div>
            </div>
          )}

          {frigateRunning && frigateUrl && (
            <div class="mt-4">
              <div class="form-group">
                <label htmlFor="frigateUrl" className="form-label">
                  <MarkupText
                    id="integration.frigate.setup.urlLabel"
                    fields={{
                      frigateUrl
                    }}
                  />
                </label>
                <div class="help-block">
                  <Text id="integration.frigate.setup.urlHelp" />
                </div>
              </div>
            </div>
          )}

          {frigateRunning && frigateAdminPassword && (
            <div>
              <div class="form-group">
                <label htmlFor="frigateUsername" className="form-label">
                  <Text id="integration.frigate.setup.usernameLabel" />
                </label>
                <Localizer>
                  <input id="frigateUsername" name="frigateUsername" value="admin" className="form-control" disabled />
                </Localizer>
              </div>

              <div class="form-group">
                <label htmlFor="frigatePassword" className="form-label">
                  <Text id="integration.frigate.setup.passwordLabel" />
                </label>
                <div class="input-icon mb-3">
                  <Localizer>
                    <input
                      id="frigatePassword"
                      name="frigatePassword"
                      type={showPassword ? 'text' : 'password'}
                      value={frigateAdminPassword}
                      className="form-control"
                      disabled
                    />
                  </Localizer>
                  <span class="input-icon-addon cursor-pointer" onClick={this.togglePassword}>
                    <i
                      class={cx('fe', {
                        'fe-eye': !showPassword,
                        'fe-eye-off': showPassword
                      })}
                    />
                  </span>
                </div>
              </div>
            </div>
          )}

          {frigateEnabled && (
            <div class="mt-3">
              <span class={vaapiAvailable ? 'tag tag-success' : 'tag tag-warning'}>
                <Text id={`integration.frigate.setup.${vaapiAvailable ? 'hardwareGpu' : 'hardwareCpu'}`} />
              </span>
            </div>
          )}

          {frigateEnabled && mqttPort && (
            <div class="mt-4">
              <div class="card-header pl-0">
                <h2 class="card-title">
                  <Text id="integration.frigate.setup.portsTitle" />
                </h2>
              </div>
              <table className="table table-responsive table-sm">
                <thead>
                  <tr>
                    <th>
                      <Text id="integration.frigate.setup.portService" />
                    </th>
                    <th>
                      <Text id="integration.frigate.setup.portNumber" />
                    </th>
                    <th>
                      <Text id="integration.frigate.setup.portAccess" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <Text id="integration.frigate.setup.portUi" />
                    </td>
                    <td>{frigateUiPort}</td>
                    <td>
                      <span class="tag tag-success">
                        <Text id="integration.frigate.setup.accessLan" />
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Text id="integration.frigate.setup.portMqtt" />
                    </td>
                    <td>{mqttPort}</td>
                    <td>
                      <span class="tag tag-success">
                        <Text id="integration.frigate.setup.accessLan" />
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Text id="integration.frigate.setup.portApi" />
                    </td>
                    <td>{frigateApiPort}</td>
                    <td>
                      <span class="tag tag-warning">
                        <Text id="integration.frigate.setup.accessLocalhost" />
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Text id="integration.frigate.setup.portRtsp" />
                    </td>
                    <td>{frigateRtspPort}</td>
                    <td>
                      <span class="tag tag-warning">
                        <Text id="integration.frigate.setup.accessLocalhost" />
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {frigateEnabled && (
            <div class="mt-4">
              <div class="card-header d-none d-sm-block pl-0">
                <h2 class="card-title">
                  <Text id="integration.frigate.setup.storageTitle" />
                </h2>
              </div>
              {recordingsStorage && (
                <div class="mb-4">
                  <div class="d-flex justify-content-between">
                    <span>
                      <Text
                        id="integration.frigate.setup.storageLabel"
                        fields={{
                          used: (recordingsStorage.used / 1024).toFixed(1),
                          total: (recordingsStorage.total / 1024).toFixed(1)
                        }}
                      />
                    </span>
                    <span class="font-weight-bold">{usedPercent}%</span>
                  </div>
                  <div class="progress mb-2">
                    <div
                      class={`progress-bar ${usedPercent >= 85 ? 'bg-danger' : 'bg-primary'}`}
                      style={{
                        width: `${usedPercent}%`
                      }}
                      role="progressbar"
                      aria-valuenow={usedPercent}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-label={usedPercent}
                    />
                  </div>
                  <div class="text-muted small">
                    <Text
                      id="integration.frigate.setup.storageFree"
                      fields={{
                        free: (recordingsStorage.free / 1024).toFixed(1)
                      }}
                    />
                  </div>
                </div>
              )}
              <p>
                <Text id="integration.frigate.setup.retentionHelp" />
              </p>
              <div class="row">
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.frigate.setup.retentionContinuousLabel" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      class="form-control"
                      value={recordContinuousDays}
                      onInput={this.updateRetention('recordContinuousDays')}
                    />
                    <small class="text-muted">
                      <Text id="integration.frigate.setup.retentionContinuousHelp" />
                    </small>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.frigate.setup.retentionAlertsLabel" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      class="form-control"
                      value={recordAlertsDays}
                      onInput={this.updateRetention('recordAlertsDays')}
                    />
                    <small class="text-muted">
                      <Text id="integration.frigate.setup.retentionAlertsHelp" />
                    </small>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.frigate.setup.retentionDetectionsLabel" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      class="form-control"
                      value={recordDetectionsDays}
                      onInput={this.updateRetention('recordDetectionsDays')}
                    />
                    <small class="text-muted">
                      <Text id="integration.frigate.setup.retentionDetectionsHelp" />
                    </small>
                  </div>
                </div>
              </div>
              <button
                class="btn btn-primary"
                onClick={this.saveRetention}
                disabled={!retentionValid || retentionStatus === RequestStatus.Getting}
              >
                <Text id="integration.frigate.setup.retentionApply" />
              </button>
              {retentionStatus === RequestStatus.Success && (
                <div class="alert alert-success mt-2">
                  <Text id="integration.frigate.setup.retentionSaved" />
                </div>
              )}
              {retentionStatus === RequestStatus.Error && (
                <div class="alert alert-danger mt-2">
                  <Text id="integration.frigate.setup.retentionError" />
                </div>
              )}
            </div>
          )}

          {frigateEnabled && (
            <div class="mt-4">
              <div class="card-header d-none d-sm-block pl-0">
                <h2 class="card-title">
                  <Text id="integration.frigate.setup.serviceStatus" />
                </h2>
              </div>
              <div class="row justify-content-center">
                <div class="col-auto">
                  <table className="table table-responsive table-borderless table-sm d-none d-sm-block">
                    <thead class="text-center">
                      <tr>
                        <th className="text-center">
                          <Text id="integration.frigate.setup.gladys" />
                        </th>
                        <th className="text-center" />
                        <th className="text-center">
                          <Text id="integration.frigate.setup.mqttBroker" />
                        </th>
                        <th className="text-center" />
                        <th className="text-center">Frigate</th>
                      </tr>
                    </thead>
                    <tbody class="text-center">
                      <tr>
                        <td className="text-center">
                          <img
                            src="/assets/icons/favicon-96x96.png"
                            alt={`Gladys`}
                            title={`Gladys`}
                            width="80"
                            height="80"
                          />
                        </td>
                        <td className={style.tdCenter}>
                          <hr className={style.line} />
                          <i
                            className={cx('fe', {
                              'fe-check': gladysConnected,
                              'fe-x': !gladysConnected,
                              greenIcon: gladysConnected,
                              redIcon: !gladysConnected
                            })}
                          />
                          <hr className={style.line} />
                        </td>
                        <td className="text-center">
                          <img
                            src="/assets/integrations/logos/logo_mqtt.png"
                            alt={`MQTT`}
                            title={`MQTT`}
                            width="80"
                            height="80"
                          />
                        </td>
                        <td className={style.tdCenter}>
                          <hr className={style.line} />
                          <i
                            className={cx('fe', {
                              'fe-check': frigateConnected,
                              'fe-x': !frigateConnected,
                              greenIcon: frigateConnected,
                              redIcon: !frigateConnected
                            })}
                          />
                          <hr className={style.line} />
                        </td>
                        <td className="text-center">
                          <i class={cx('fe', 'fe-video', style.frigateIcon)} title={`Frigate`} />
                        </td>
                      </tr>
                      <tr>
                        <td className="text-center">
                          <div class="tag tag-success">
                            <Text id={`systemSettings.containerState.running`} />
                          </div>
                        </td>
                        <td className="text-center" />
                        <td className="text-center">
                          <span class={mqttRunning ? 'tag tag-success' : 'tag tag-danger'}>
                            <Text id={`systemSettings.containerState.${mqttRunning ? 'running' : 'exited'}`} />
                          </span>
                        </td>
                        <td className="text-center" />
                        <td className="text-center">
                          <span class={frigateRunning ? 'tag tag-success' : 'tag tag-danger'}>
                            <Text id={`systemSettings.containerState.${frigateRunning ? 'running' : 'exited'}`} />
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="card-header d-sm-none pl-0">
                <h2 class="card-title">
                  <Text id="integration.frigate.setup.containersStatus" />
                </h2>
              </div>
              <div class="row justify-content-center d-sm-none">
                <div class="col-auto">
                  <table className="table table-responsive table-borderless table-sm">
                    <thead class="text-center">
                      <tr>
                        <th>
                          <Text id="systemSettings.containers" />
                        </th>
                        <th>
                          <Text id="integration.frigate.setup.status" />
                        </th>
                      </tr>
                    </thead>
                    <tbody class="text-center">
                      <tr>
                        <td>
                          <Text id="integration.frigate.setup.gladys" />
                        </td>
                        <td>
                          <span class="tag tag-success">
                            <Text id={`systemSettings.containerState.running`} />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <Text id="integration.frigate.setup.mqttBroker" />
                        </td>
                        <td>
                          <span class={mqttRunning ? 'tag tag-success' : 'tag tag-danger'}>
                            <Text id={`systemSettings.containerState.${mqttRunning ? 'running' : 'exited'}`} />
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td>Frigate</td>
                        <td>
                          <span class={frigateRunning ? 'tag tag-success' : 'tag tag-danger'}>
                            <Text id={`systemSettings.containerState.${frigateRunning ? 'running' : 'exited'}`} />
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default SetupTab;
