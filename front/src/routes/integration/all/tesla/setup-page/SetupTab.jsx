import { Text, Localizer, MarkupText } from 'preact-i18n';
import cx from 'classnames';

import style from './style.css';
import StateConnection from './StateConnection';
import { RequestStatus } from '../../../../../utils/consts';
import { STATUS } from '../../../../../../../server/services/tesla/lib/utils/tesla.constants';
import { Component } from 'preact';
import { connect } from 'unistore/preact';

class SetupTab extends Component {
  showClientSecretTimer = null;

  async disconnectTesla(e) {
    e.preventDefault();

    await this.setState({
      teslaDisconnectStatus: RequestStatus.Getting
    });
    try {
      await this.props.httpClient.post('/api/v1/service/tesla/disconnect');
      this.props.updateStateInIndex({ connectTeslaStatus: STATUS.DISCONNECTED });
      await this.setState({
        teslaDisconnectStatus: RequestStatus.Success
      });
    } catch (e) {
      await this.setState({
        teslaSaveSettingsStatus: RequestStatus.Error
      });
    }
  }

  updateClientId = e => {
    this.props.updateStateInIndex({ teslaClientId: e.target.value });
  };

  updateClientSecret = e => {
    this.props.updateStateInIndex({ teslaClientSecret: e.target.value });
  };

  toggleClientSecret = () => {
    const { showClientSecret } = this.state;

    if (this.showClientSecretTimer) {
      clearTimeout(this.showClientSecretTimer);
      this.showClientSecretTimer = null;
    }

    this.setState({ showClientSecret: !showClientSecret });

    if (!showClientSecret) {
      this.showClientSecretTimer = setTimeout(() => this.setState({ showClientSecret: false }), 5000);
    }
  };

  componentWillUnmount() {
    if (this.showClientSecretTimer) {
      clearTimeout(this.showClientSecretTimer);
      this.showClientSecretTimer = null;
    }
  }

  render(props, state, { loading }) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.tesla.setup.title" />
          </h1>
        </div>
        <div class="card-body">
          <div
            class={cx('dimmer', {
              active: loading
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              <StateConnection {...props} />
              <p>
                <MarkupText id="integration.tesla.setup.description" />
                <MarkupText id="integration.tesla.setup.descriptionCreateAccount" />
                <MarkupText id="integration.tesla.setup.descriptionCreateProject" />
                <MarkupText id="integration.tesla.setup.descriptionGetKeys" />
              </p>
              <p>
                <label htmlFor="descriptionScopeInformation" className={`form-label ${style.italicText}`}>
                  <MarkupText id="integration.tesla.setup.descriptionScopeInformation" />
                </label>
              </p>

              <form>
                <div class="form-group">
                  <label htmlFor="teslaClientId" className="form-label">
                    <Text id={`integration.tesla.setup.clientIdLabel`} />
                  </label>
                  <Localizer>
                    <input
                      name="teslaClientId"
                      type="text"
                      placeholder={<Text id="integration.tesla.setup.clientIdPlaceholder" />}
                      value={props.teslaClientId}
                      className="form-control"
                      autocomplete="off"
                      onInput={this.updateClientId}
                    />
                  </Localizer>
                </div>

                <div class="form-group">
                  <label htmlFor="teslaClientSecret" className="form-label">
                    <Text id={`integration.tesla.setup.clientSecretLabel`} />
                  </label>
                  <div class="input-icon mb-3">
                    <Localizer>
                      <input
                        id="teslaClientSecret"
                        name="teslaClientSecret"
                        type={state.showClientSecret ? 'text' : 'password'}
                        placeholder={<Text id="integration.tesla.setup.clientSecretPlaceholder" />}
                        value={props.teslaClientSecret}
                        className="form-control"
                        autocomplete="off"
                        onInput={this.updateClientSecret}
                      />
                    </Localizer>
                    <span class="input-icon-addon cursor-pointer" onClick={this.toggleClientSecret}>
                      <i
                        class={cx('fe', {
                          'fe-eye': !state.showClientSecret,
                          'fe-eye-off': state.showClientSecret
                        })}
                      />
                    </span>
                  </div>
                </div>

                <div class="form-group">
                  <label htmlFor="teslaSetupConnectionInfo" className="form-label">
                    <Text id="integration.tesla.setup.connectionInfoLabel" />
                  </label>
                </div>
                {props.notOnGladysGateway && (
                  <div class={style.buttonGroup}>
                    <Localizer>
                      <button type="submit" class={`btn btn-success`} onClick={props.saveConfiguration}>
                        <Text id="integration.tesla.setup.saveLabel" />
                      </button>
                    </Localizer>
                    {props.notOnGladysGateway && props.connected && (
                      <button
                        onClick={this.disconnectTesla.bind(this)}
                        class={`btn btn-danger`}
                        disabled={props.connectTeslaStatus === STATUS.DISCONNECTING}
                      >
                        <Text id="integration.tesla.setup.disconnectLabel" />
                      </button>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('user,session,httpClient', {})(SetupTab);
