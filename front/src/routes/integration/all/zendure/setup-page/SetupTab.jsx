import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { Text, Localizer, MarkupText } from 'preact-i18n';
import cx from 'classnames';
import get from 'get-value';

import { RequestStatus } from '../../../../../utils/consts';

class SetupTab extends Component {
  componentWillMount() {
    this.getZendureConfiguration();
    this.getZendureStatus();
  }

  async getZendureConfiguration() {
    this.setState({
      zendureGetSettingsStatus: RequestStatus.Getting,
      zendureAppToken: '',
      zendureSavedAppToken: '',
    });

    try {
      const { value: appToken } = await this.props.httpClient.get('/api/v1/service/zendure/variable/ZENDURE_APP_TOKEN');
      this.setState({
        zendureGetSettingsStatus: RequestStatus.Success,
        zendureAppToken: appToken || '',
        zendureSavedAppToken: appToken || '',
      });
    } catch (e) {
      this.setState({
        zendureGetSettingsStatus: RequestStatus.Error,
      });
    }
  }

  async getZendureStatus() {
    this.setState({
      zendureGetStatus: RequestStatus.Getting,
      zendureConnected: false,
    });

    try {
      const status = await this.props.httpClient.get('/api/v1/service/zendure/status');
      this.setState({
        zendureGetStatus: RequestStatus.Success,
        zendureConnected: status.connected === true,
      });
      return status;
    } catch (e) {
      this.setState({
        zendureGetStatus: RequestStatus.Error,
        zendureConnected: false,
      });
      return {
        connected: false,
      };
    }
  }

  saveZendureConfiguration = async (e) => {
    e.preventDefault();

    const appToken = this.state.zendureAppToken.trim();

    this.setState({
      zendureSaveSettingsStatus: RequestStatus.Getting,
      zendureSaveSettingsErrorMessage: null,
    });

    try {
      await this.props.httpClient.post('/api/v1/service/zendure/variable/ZENDURE_APP_TOKEN', {
        value: appToken,
      });

      await this.props.httpClient.post('/api/v1/service/zendure/connect');
      const status = await this.getZendureStatus();
      if (!status || status.connected !== true) {
        throw new Error('Zendure cloud connection check failed.');
      }

      this.setState({
        zendureSaveSettingsStatus: RequestStatus.Success,
        zendureConnected: true,
        zendureSavedAppToken: appToken,
      });
    } catch (e) {
      this.setState({
        zendureSaveSettingsStatus: RequestStatus.Error,
        zendureConnected: false,
        zendureSaveSettingsErrorMessage: get(e, 'response.data.message') || get(e, 'response.data.code') || e.message,
      });
    }
  };

  updateConfiguration = (e) => {
    this.setState({
      [e.target.name]: e.target.value,
    });
  };

  render(props, state) {
    const trimmedToken = (state.zendureAppToken || '').trim();
    const savedTrimmedToken = (state.zendureSavedAppToken || '').trim();
    const tokenIsEmpty = trimmedToken.length === 0;
    const tokenIsUnchanged = trimmedToken === savedTrimmedToken;
    const connectedAndUnchanged = state.zendureConnected === true && tokenIsUnchanged && !tokenIsEmpty;
    const buttonDisabled = state.zendureSaveSettingsStatus === RequestStatus.Getting || tokenIsEmpty || connectedAndUnchanged;

    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.zendure.setup.title" />
          </h1>
        </div>
        <div class="card-body">
          <div
            class={cx('dimmer', {
              active: state.zendureSaveSettingsStatus === RequestStatus.Getting,
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              {tokenIsEmpty && (
                <div class="alert alert-warning">
                  <Text id="integration.zendure.setup.notConfigured" />
                </div>
              )}

              {connectedAndUnchanged && (
                <div class="alert alert-success">
                  <Text id="integration.zendure.setup.connectedStatus" />
                </div>
              )}

              {state.zendureSaveSettingsStatus === RequestStatus.Error && (
                <div class="alert alert-danger">
                  <Text id="integration.zendure.setup.saveError" />
                  {state.zendureSaveSettingsErrorMessage && (
                    <div>
                      <small>{state.zendureSaveSettingsErrorMessage}</small>
                    </div>
                  )}
                </div>
              )}

              <div class="alert alert-secondary mb-4">
                <MarkupText id="integration.zendure.setup.description" />
              </div>

              <form>
                <div class="form-group">
                  <label for="zendureAppToken" class="form-label">
                    <Text id="integration.zendure.setup.tokenLabel" />
                  </label>
                  <Localizer>
                    <input
                      name="zendureAppToken"
                      type="text"
                      placeholder={<Text id="integration.zendure.setup.tokenPlaceholder" />}
                      value={state.zendureAppToken}
                      class="form-control"
                      onInput={this.updateConfiguration}
                    />
                  </Localizer>
                </div>

                <div class="row mt-5">
                  <div class="col">
                    <button type="submit" class="btn btn-success" onClick={this.saveZendureConfiguration} disabled={buttonDisabled}>
                      <Text id={connectedAndUnchanged ? 'integration.zendure.setup.connectedLabel' : 'integration.zendure.setup.saveLabel'} />
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
