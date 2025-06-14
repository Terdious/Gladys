import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { route } from 'preact-router';
import SetupTab from './SetupTab';
import TeslaPage from '../TeslaPage';
import withIntlAsProp from '../../../../../utils/withIntlAsProp';
import { WEBSOCKET_MESSAGE_TYPES } from '../../../../../../../server/utils/constants';
import { STATUS } from '../../../../../../../server/services/tesla/lib/utils/tesla.constants';
import { RequestStatus } from '../../../../../utils/consts';

class TeslaSetupPage extends Component {
    getRedirectUri = async () => {
        try {
            const result = await this.props.httpClient.post('/api/v1/service/tesla/connect');
            // const redirectUri = `${result.authUrl}&redirect_uri=${encodeURIComponent(this.state.redirectUriTeslaSetup)}`;
            const redirectUri = `${result.authUrl}&redirect_uri=${encodeURIComponent("http://localhost:1444/dashboard/integration/device/tesla/setup")}`;
            // redirectUri: 'http://localhost:1444',
            // const redirectUri = `${result.authUrl}`;
            await this.setState({
                redirectUri
            });
        } catch (e) {
            console.error(e);
            await this.setState({ errored: true });
        }
    };

    getSessionGatewayClient = async () => {
        if (!this.props.session.gatewayClient) {
            this.setState({
                notOnGladysGateway: true,
                redirectUriTeslaSetup: `${window.location.origin}/dashboard/integration/device/tesla/setup`
            });
        } else return;
    };

    detectCode = async () => {
        if (this.props.error) {
            if (this.props.error === 'access_denied' || this.props.error === 'invalid_client') {
                this.props.httpClient.post('/api/v1/service/tesla/status', {
                    statusType: STATUS.ERROR.CONNECTING,
                    message: this.props.error
                });
                await this.setState({
                    connectTeslaStatus: STATUS.DISCONNECTED,
                    connected: false,
                    configured: true,
                    accessDenied: true,
                    messageAlert: this.props.error
                });
            } else {
                this.props.httpClient.post('/api/v1/service/tesla/status', {
                    statusType: STATUS.ERROR.CONNECTING,
                    message: 'other_error'
                });
                await this.setState({
                    accessDenied: true,
                    messageAlert: 'other_error',
                    errored: true
                });
                console.error('Logs error', this.props);
            }
        }
        if (this.props.code && this.props.state) {
            let successfulNewToken = false;
            try {
                await this.setState({
                    connectTeslaStatus: STATUS.PROCESSING_TOKEN,
                    connected: false,
                    configured: true,
                    errored: false
                });
                const response = await this.props.httpClient.post('/api/v1/service/tesla/token', {
                    codeOAuth: this.props.code,
                    redirectUri: this.state.redirectUriTeslaSetup,
                    state: this.props.state
                });
                if (response) successfulNewToken = true;
                await this.props.httpClient.post('/api/v1/service/tesla/variable/TESLA_CONNECTED', {
                    value: successfulNewToken
                });
                await this.setState({
                    connectTeslaStatus: STATUS.CONNECTED,
                    connected: true,
                    configured: true,
                    errored: false
                });
                await this.props.httpClient.get('/api/v1/service/tesla/discover', { refresh: true });
                setTimeout(() => {
                    route('/dashboard/integration/device/tesla/setup', true);
                }, 100);
            } catch (e) {
                console.error(e);
                this.props.httpClient.post('/api/v1/service/tesla/status', {
                    statusType: STATUS.PROCESSING_TOKEN,
                    message: 'other_error'
                });
                await this.setState({
                    connectTeslaStatus: STATUS.DISCONNECTED,
                    connected: false,
                    configured: true,
                    errored: true
                });
            }
        }
    };

    saveConfiguration = async e => {
        e.preventDefault();

        try {
            this.props.httpClient.post('/api/v1/service/tesla/configuration', {
                clientId: this.state.teslaClientId,
                clientSecret: this.state.teslaClientSecret
            });
            await this.setState({
                teslaSaveSettingsStatus: RequestStatus.Success
            });
        } catch (e) {
            await this.setState({
                teslaSaveSettingsStatus: RequestStatus.Error,
                errored: true
            });
        }
        try {
            await this.setState({
                connectTeslaStatus: STATUS.CONNECTING,
                connected: false,
                configured: true
            });
            await this.getRedirectUri();
            const redirectUri = this.state.redirectUri;
            const regex = /dashboard|integration|device|tesla|setup/;
            if (redirectUri && regex.test(this.state.redirectUri)) {
                window.location.href = this.state.redirectUri;
                await this.setState({
                    connectTeslaStatus: RequestStatus.Success,
                    connected: false,
                    configured: true
                });
            } else {
                console.error('Missing redirect URL');
                await this.setState({
                    connectTeslaStatus: STATUS.ERROR.CONNECTING,
                    connected: false
                });
            }
        } catch (e) {
            console.error('Error when redirecting to tesla', e);

            await this.setState({
                connectTeslaStatus: STATUS.ERROR.CONNECTING,
                connected: false,
                errored: true
            });
        }
    };

    loadProps = async () => {
        let configuration = {};
        try {
            configuration = await this.props.httpClient.get('/api/v1/service/tesla/configuration');
        } catch (e) {
            console.error(e);
            await this.setState({ errored: true });
        } finally {
            await this.setState({
                teslaClientId: configuration.clientId,
                teslaClientSecret: configuration.clientSecret,
                clientSecretChanges: false
            });
        }
    };

    loadStatus = async () => {
        try {
            const teslaStatus = await this.props.httpClient.get('/api/v1/service/tesla/status');
            await this.setState({
                connectTeslaStatus: teslaStatus.status,
                connected: teslaStatus.connected,
                configured: teslaStatus.configured
            });
        } catch (e) {
            await this.setState({
                teslaConnectionError: RequestStatus.NetworkError,
                errored: true
            });
            console.error(e);
        }
    };

    init = async () => {
        await this.setState({ loading: true, errored: false });
        await Promise.all([this.getSessionGatewayClient(), this.detectCode()]);
        await this.setState({ loading: false });
    };

    updateStatus = async state => {
        let connected = false;
        let configured = false;
        if (
            state.status === STATUS.CONNECTED ||
            state.status === STATUS.GET_DEVICES_VALUES ||
            state.status === STATUS.DISCOVERING_DEVICES
        ) {
            connected = true;
            configured = true;
        } else if (state.status === STATUS.NOT_INITIALIZED) {
            connected = false;
            configured = false;
        } else {
            connected = false;
            configured = true;
        }
        await this.setState({
            connectTeslaStatus: state.status,
            connected,
            configured
        });
    };

    updateStatusError = async state => {
        switch (state.statusType) {
            case STATUS.CONNECTING:
                if (state.status !== 'other_error') {
                    this.setState({
                        connectTeslaStatus: STATUS.DISCONNECTED,
                        connected: false,
                        accessDenied: true,
                        messageAlert: state.status
                    });
                } else {
                    this.setState({
                        connectTeslaStatus: STATUS.DISCONNECTED,
                        connected: false,
                        errored: true
                    });
                }
                break;
            case STATUS.PROCESSING_TOKEN:
                if (state.status === 'get_access_token_fail') {
                    this.setState({
                        connectTeslaStatus: STATUS.DISCONNECTED,
                        connected: false,
                        accessDenied: true,
                        messageAlert: state.status
                    });
                } else if (state.status === 'invalid_client') {
                    this.setState({
                        connectTeslaStatus: STATUS.DISCONNECTED,
                        connected: false,
                        accessDenied: true,
                        messageAlert: state.status
                    });
                } else {
                    this.setState({
                        connectTeslaStatus: STATUS.DISCONNECTED,
                        connected: false,
                        errored: true
                    });
                }
                break;
        }
    };

    handleStateUpdateFromChild = newState => {
        this.setState(newState);
    };

    componentDidMount() {
        console.log('tesla setup page init');
        this.init();
        console.log('tesla setup page loadProps');
        this.loadProps();
        console.log('tesla setup page loadStatus');
        this.loadStatus();
        this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.TESLA.STATUS, this.updateStatus);
        this.props.session.dispatcher.addListener(WEBSOCKET_MESSAGE_TYPES.TESLA.ERROR.CONNECTING, this.updateStatusError);
        this.props.session.dispatcher.addListener(
            WEBSOCKET_MESSAGE_TYPES.TESLA.ERROR.PROCESSING_TOKEN,
            this.updateStatusError
        );
    }

    componentWillUnmount() {
        this.props.session.dispatcher.removeListener(WEBSOCKET_MESSAGE_TYPES.TESLA.STATUS, this.updateStatus);
        this.props.session.dispatcher.removeListener(
            WEBSOCKET_MESSAGE_TYPES.TESLA.ERROR.CONNECTING,
            this.updateStatusError
        );
        this.props.session.dispatcher.removeListener(
            WEBSOCKET_MESSAGE_TYPES.TESLA.ERROR.PROCESSING_TOKEN,
            this.updateStatusError
        );
    }

    render(props, state, { loading }) {
        return (
            <TeslaPage {...props}>
                <SetupTab
                    {...props}
                    {...state}
                    loading={loading}
                    loadProps={this.loadProps}
                    updateStateInIndex={this.handleStateUpdateFromChild}
                    saveConfiguration={this.saveConfiguration}
                />
            </TeslaPage>
        );
    }
}

export default withIntlAsProp(connect('user,session,httpClient', {})(TeslaSetupPage));
