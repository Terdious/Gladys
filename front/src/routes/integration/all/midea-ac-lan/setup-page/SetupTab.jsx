import { Text, Localizer, MarkupText } from 'preact-i18n';
import cx from 'classnames';
import { RequestStatus } from '../../../../../utils/consts';
import { Component } from 'preact';
import { connect } from 'unistore/preact';

class SetupTab extends Component {
  showPasswordTimer = null;

  componentWillMount() {
    this.getConfiguration();
  }

  async getConfiguration() {
    let mideaUser = '';
    let mideaPassword = '';
    let mideaProvider = 'MSmartHome';

    this.setState({ mideaGetSettingsStatus: RequestStatus.Getting, mideaUser, mideaPassword });
    try {
      const { value: user } = await this.props.httpClient.get('/api/v1/service/midea-ac-lan/variable/MIDEA_USER');
      mideaUser = user;
      const { value: password } = await this.props.httpClient.get(
        '/api/v1/service/midea-ac-lan/variable/MIDEA_PASSWORD'
      );
      mideaPassword = password;
      try {
        const { value: provider } = await this.props.httpClient.get(
          '/api/v1/service/midea-ac-lan/variable/MIDEA_PROVIDER'
        );
        if (provider) mideaProvider = provider;
      } catch (eGetProv) {}
      // statut cloud
      let cloudConnected = false;
      try {
        const status = await this.props.httpClient.get('/api/v1/service/midea-ac-lan/status');
        cloudConnected = !!status.connected;
      } catch (eStatus) {}
      this.setState({
        mideaGetSettingsStatus: RequestStatus.Success,
        mideaUser,
        mideaPassword,
        mideaProvider,
        cloudConnected
      });
    } catch (e) {
      this.setState({ mideaGetSettingsStatus: RequestStatus.Error });
    }
  }

  saveConfiguration = async e => {
    e.preventDefault();
    this.setState({ mideaSaveSettingsStatus: RequestStatus.Getting });
    try {
      // Persist provider/user/password as variables de service
      await this.props.httpClient.post('/api/v1/service/midea-ac-lan/variable/MIDEA_PROVIDER', {
        value: this.state.mideaProvider || 'MSmartHome'
      });
      await this.props.httpClient.post('/api/v1/service/midea-ac-lan/variable/MIDEA_USER', {
        value: (this.state.mideaUser && this.state.mideaUser.trim()) || ''
      });
      await this.props.httpClient.post('/api/v1/service/midea-ac-lan/variable/MIDEA_PASSWORD', {
        value: (this.state.mideaPassword && this.state.mideaPassword.trim()) || ''
      });
      const result = await this.props.httpClient.post('/api/v1/service/midea-ac-lan/connect', {
        user: (this.state.mideaUser && this.state.mideaUser.trim()) || '',
        password: (this.state.mideaPassword && this.state.mideaPassword.trim()) || ''
      });
      // eslint-disable-next-line no-console
      console.log('[Midea AC LAN] Connect result:', result);
      this.setState({
        mideaSaveSettingsStatus: RequestStatus.Success,
        cloudDevices: result.devices || [],
        cloudConnected: !!result.connected
      });
    } catch (e) {
      this.setState({ mideaSaveSettingsStatus: RequestStatus.Error });
    }
  };

  clearLoginCache = async e => {
    e.preventDefault();
    this.setState({ clearing: true });
    try {
      await this.props.httpClient.post('/api/v1/service/midea-ac-lan/clear-cache');
      await this.getConfiguration();
    } catch (e2) {}
    this.setState({ clearing: false });
  };

  updateConfiguration = e => {
    this.setState({ [e.target.name]: e.target.value });
  };

  manualUpdate = e => {
    this.setState({ [e.target.name]: e.target.value });
  };

  manualAdd = async e => {
    e.preventDefault();
    this.setState({ manualAddStatus: RequestStatus.Getting, manualAddError: null, manualAddSuccess: false });
    try {
      const payload = {
        id: this.state.manualId,
        name: this.state.manualName,
        host: this.state.manualHost,
        port: Number(this.state.manualPort) || 6444,
        key: this.state.manualKey,
        token: this.state.manualToken
      };
      const created = await this.props.httpClient.post('/api/v1/service/midea-ac-lan/device', payload);
      // eslint-disable-next-line no-console
      console.log('[Midea AC LAN] Device created response:', created);
      // Structure attendue: { device, source, capabilities, features }
      this.setState({
        manualAddStatus: RequestStatus.Success,
        manualAddSuccess: true,
        manualCreatedDevice: created.device || created,
        manualSource: created.source,
        manualCapabilities: created.capabilities,
        manualFeatures: created.features
      });
    } catch (e2) {
      this.setState({ manualAddStatus: RequestStatus.Error, manualAddError: true });
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

  render(props, state) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.mideaAcLan.setup.title" />
          </h1>
        </div>
        <div class="card-body">
          <div class={cx('dimmer', { active: state.mideaSaveSettingsStatus === RequestStatus.Getting })}>
            <div class="loader" />
            <div class="dimmer-content">
              <div class="mb-3">
                <span class={cx('badge', state.cloudConnected ? 'badge-success' : 'badge-secondary')}>
                  {state.cloudConnected ? 'Connecté au cloud' : 'Déconnecté du cloud'}
                </span>
              </div>
              <p>
                <MarkupText id="integration.mideaAcLan.setup.description" />
              </p>
              <form>
                <div class="form-group">
                  <label for="mideaProvider" class="form-label">
                    <Text id="integration.mideaAcLan.setup.provider" />
                  </label>
                  <select
                    name="mideaProvider"
                    id="mideaProvider"
                    class="form-control"
                    onChange={this.updateConfiguration}
                    value={state.mideaProvider || 'MSmartHome'}
                  >
                    <option value="MSmartHome">MSmartHome (EU)</option>
                    <option value="MideaAir">MideaAir</option>
                    <option value="NetHomePlus">NetHomePlus</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="mideaUser" class="form-label">
                    <Text id={`integration.mideaAcLan.setup.user`} />
                  </label>
                  <Localizer>
                    <input
                      name="mideaUser"
                      type="text"
                      placeholder={<Text id="integration.mideaAcLan.setup.userPlaceholder" />}
                      value={state.mideaUser}
                      class="form-control"
                      onInput={this.updateConfiguration}
                    />
                  </Localizer>
                </div>

                <div class="form-group">
                  <label htmlFor="mideaPassword" className="form-label">
                    <Text id={`integration.mideaAcLan.setup.password`} />
                  </label>
                  <div class="input-icon mb-3">
                    <Localizer>
                      <input
                        name="mideaPassword"
                        type={state.showPassword ? 'text' : 'password'}
                        placeholder={<Text id="integration.mideaAcLan.setup.passwordPlaceholder" />}
                        value={state.mideaPassword}
                        className="form-control"
                        onInput={this.updateConfiguration}
                      />
                    </Localizer>
                    <span class="input-icon-addon cursor-pointer" onClick={this.togglePassword}>
                      <i class={cx('fe', { 'fe-eye': !state.showPassword, 'fe-eye-off': state.showPassword })} />
                    </span>
                  </div>
                </div>

                <div class="row mt-5">
                  <div class="col">
                    <button type="submit" class="btn btn-success" onClick={this.saveConfiguration}>
                      <Text id="integration.mideaAcLan.setup.saveLabel" />
                    </button>
                    <button type="button" class="btn btn-outline-danger ml-2" onClick={this.clearLoginCache} disabled={state.clearing}>
                      Remove login cache
                    </button>
                  </div>
                </div>
              </form>

              {typeof state.cloudDevices !== 'undefined' && (
                <div class="mt-4">
                  <h2 class="card-title h4">Appareils (cloud) — {state.cloudDevices.length}</h2>
                  <pre class="card p-3">{JSON.stringify(state.cloudDevices, null, 2)}</pre>
                </div>
              )}

              <hr />

              <h2 class="card-title h4">
                <Text id="integration.mideaAcLan.manual.title" />
              </h2>
              <form>
                <div class="row">
                  <div class="col-md-6">
                    <div class="form-group">
                      <label class="form-label" for="manualId">
                        <Text id="integration.mideaAcLan.manual.idLabel" />
                      </label>
                      <input name="manualId" id="manualId" type="text" class="form-control" onInput={this.manualUpdate} value={state.manualId || ''} />
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label class="form-label" for="manualName">
                        <Text id="integration.mideaAcLan.manual.nameLabel" />
                      </label>
                      <input name="manualName" id="manualName" type="text" class="form-control" onInput={this.manualUpdate} value={state.manualName || ''} />
                    </div>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6">
                    <div class="form-group">
                      <label class="form-label" for="manualHost">
                        <Text id="integration.mideaAcLan.manual.hostLabel" />
                      </label>
                      <input name="manualHost" id="manualHost" type="text" class="form-control" onInput={this.manualUpdate} value={state.manualHost || ''} />
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label class="form-label" for="manualPort">
                        <Text id="integration.mideaAcLan.manual.portLabel" />
                      </label>
                      <input name="manualPort" id="manualPort" type="number" class="form-control" onInput={this.manualUpdate} value={state.manualPort || ''} />
                    </div>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6">
                    <div class="form-group">
                      <label class="form-label" for="manualKey">
                        <Text id="integration.mideaAcLan.manual.keyLabel" />
                      </label>
                      <input name="manualKey" id="manualKey" type="text" class="form-control" onInput={this.manualUpdate} value={state.manualKey || ''} />
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-group">
                      <label class="form-label" for="manualToken">
                        <Text id="integration.mideaAcLan.manual.tokenLabel" />
                      </label>
                      <input name="manualToken" id="manualToken" type="text" class="form-control" onInput={this.manualUpdate} value={state.manualToken || ''} />
                    </div>
                  </div>
                </div>

                {state.manualAddStatus === RequestStatus.Success && (
                  <div class="alert alert-success">
                    <Text id="integration.mideaAcLan.manual.success" />
                  </div>
                )}
                {(state.manualCreatedDevice || state.manualSource) && (
                  <div class="mb-3">
                    <details>
                      <summary>Debug payload</summary>
                      {state.manualSource && (
                        <>
                          <h6>Source (raw)</h6>
                          <pre class="card p-3">{JSON.stringify(state.manualSource, null, 2)}</pre>
                          <h6>Capabilities</h6>
                          <pre class="card p-3">{JSON.stringify(state.manualCapabilities, null, 2)}</pre>
                          <h6>Features (built)</h6>
                          <pre class="card p-3">{JSON.stringify(state.manualFeatures, null, 2)}</pre>
                        </>
                      )}
                      <h6>Gladys device</h6>
                      <pre class="card p-3">{JSON.stringify(state.manualCreatedDevice, null, 2)}</pre>
                    </details>
                  </div>
                )}
                {state.manualAddStatus === RequestStatus.Error && (
                  <div class="alert alert-danger">
                    <Text id="integration.mideaAcLan.manual.error" />
                  </div>
                )}

                <div class="row mt-2">
                  <div class="col">
                    <button type="submit" class="btn btn-primary" onClick={this.manualAdd}>
                      <Text id="integration.mideaAcLan.manual.addButton" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient', {})(SetupTab);


