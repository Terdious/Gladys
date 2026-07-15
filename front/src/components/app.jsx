import { h, Component } from 'preact';
import { Router } from 'preact-router';
import createStore from 'unistore';
import get from 'get-value';
import config from '../config';
import { Provider, connect } from 'unistore/preact';
import AsyncRoute from 'preact-async-route';
import { IntlProvider } from 'preact-i18n';
import translations from '../config/i18n';
import actions from '../actions/main';

import { getDefaultState } from '../utils/getDefaultState';

import Header from './header';
import Layout from './layout';
import Redirect from './router/Redirect';
import Login from '../routes/login';
import Locked from '../routes/locked';
import Error from '../routes/error';
import ErrorNoAuthorize from '../routes/error-no-authorize';
import ForgotPassword from '../routes/forgot-password';
import ResetPassword from '../routes/reset-password';

// Gateway
import LoginGateway from '../routes/login-gateway';
import LinkGatewayUser from '../routes/gateway-setup';
import SignupGateway from '../routes/signup-gateway';
import ConfigureTwoFactorGateway from '../routes/gateway-configure-two-factor';
import GatewayForgotPassword from '../routes/gateway-forgot-password';
import GatewayResetPassword from '../routes/gateway-reset-password';
import GatewayConfirmEmail from '../routes/gateway-confirm-email';
import GoogleHomeGateway from '../routes/integration/all/google-home-gateway';
import AlexaGateway from '../routes/integration/all/alexa-gateway';
import EnedisGateway from '../routes/integration/all/enedis-gateway/Welcome';
import EnedisGatewayUsagePoints from '../routes/integration/all/enedis-gateway/UsagePoints';

import SignupWelcomePage from '../routes/signup/1-welcome';
import SignupCreateAccountLocal from '../routes/signup/2-create-account-local';
import SignupCreateAccountGladysGateway from '../routes/signup/2-create-account-gladys-gateway';
import SignupPreferences from '../routes/signup/3-preferences';
import SignupConfigureHouse from '../routes/signup/4-configure-house';
import SignupSuccess from '../routes/signup/5-success';

// Dashboard
import Dashboard from '../routes/dashboard';
import NewDashboard from '../routes/dashboard/new-dashboard';
import EditDashboard from '../routes/dashboard/edit-dashboard';

import IntegrationPage from '../routes/integration';
import HistoryPage from '../routes/history';
import ChatPage from '../routes/chat';
import MapPage from '../routes/map';
import MapNewAreaPage from '../routes/map/NewArea';
import CalendarPage from '../routes/calendar';
import ScenePage from '../routes/scene';
import NewScenePage from '../routes/scene/new-scene';
import DuplicateScenePage from '../routes/scene/duplicate-scene';
import EditScenePage from '../routes/scene/edit-scene';
import ProfilePage from '../routes/profile';
import SettingsSessionPage from '../routes/settings/settings-session';
import SettingsHousePage from '../routes/settings/settings-house';
import SettingsUserPage from '../routes/settings/settings-users';
import SettingsEditUserPage from '../routes/settings/settings-users/edit-user';
import SettingsCreateUserPage from '../routes/settings/settings-users/create-user';
import SettingsSystemPage from '../routes/settings/settings-system';
import SettingsServicePage from '../routes/settings/settings-service';
import SettingsGateway from '../routes/settings/settings-gateway';
import SettingsBackup from '../routes/settings/settings-backup';
import SettingsBilling from '../routes/settings/settings-billing';
import SettingsGatewayUsers from '../routes/settings/settings-gateway-users';
import SettingsGatewayOpenApi from '../routes/settings/settings-gateway-open-api';
import SettingsBackgroundJobs from '../routes/settings/settings-background-jobs';

// Integrations
import TelegramPage from '../routes/integration/all/telegram';
import AlexaWelcomePage from '../routes/integration/all/alexa-gateway/welcome';
import GoogleHomeWelcomePage from '../routes/integration/all/google-home-gateway/welcome';
import HomeKitPage from '../routes/integration/all/homekit';
import OwntracksWelcomePage from '../routes/integration/all/owntracks/welcome';
import CalDAVAccountPage from '../routes/integration/all/caldav/account-page';
import CalDAVSyncPage from '../routes/integration/all/caldav/sync-page';
import CalDAVSharePage from '../routes/integration/all/caldav/share-page';
import OpenWeatherPage from '../routes/integration/all/openweather';
import PhilipsHueSetupPage from '../routes/integration/all/philips-hue/setup-page';
import PhilipsHueDevicePage from '../routes/integration/all/philips-hue/device-page';
import TPLinkDevicePage from '../routes/integration/all/tp-link/device-page';
import RtspCameraPage from '../routes/integration/all/rtsp-camera';
import XiaomiPage from '../routes/integration/all/xiaomi';
import EditXiaomiPage from '../routes/integration/all/xiaomi/edit-page';
import NextcloudTalkPage from '../routes/integration/all/nextcloud-talk';
import MCPPage from '../routes/integration/all/mcp';

// Broadlink integration
import BroadlinkDevicePage from '../routes/integration/all/broadlink/device-page';
import BroadlinkRemoteSetupPage from '../routes/integration/all/broadlink/remote-page';
import BroadlinkPeripheralPage from '../routes/integration/all/broadlink/peripheral-page';

// LAN-Manager integration
import LANManagerDevicePage from '../routes/integration/all/lan-manager/device-page';
import LANManagerDiscoverPage from '../routes/integration/all/lan-manager/discover-page';
import LANManagerSettingsPage from '../routes/integration/all/lan-manager/settings-page';

// MQTT integration
import MqttDevicePage from '../routes/integration/all/mqtt/device-page';
import MqttDeviceSetupPage from '../routes/integration/all/mqtt/device-page/setup';
import MqttSetupPage from '../routes/integration/all/mqtt/setup-page';
import MqttDebugPage from '../routes/integration/all/mqtt/debug-page/Debug';

// Zigbee2mqtt
import Zigbee2mqttPage from '../routes/integration/all/zigbee2mqtt/device-page';
import Zigbee2mqttDiscoverPage from '../routes/integration/all/zigbee2mqtt/discover-page';
import Zigbee2mqttSetupPage from '../routes/integration/all/zigbee2mqtt/setup-page';
import Zigbee2mqttEditPage from '../routes/integration/all/zigbee2mqtt/edit-page';

// Tasmota
import TasmotaPage from '../routes/integration/all/tasmota/device-page';
import TasmotaEditPage from '../routes/integration/all/tasmota/edit-page';
import TasmotaMqttDiscoverPage from '../routes/integration/all/tasmota/discover-mqtt';
import TasmotaHttpDiscoverPage from '../routes/integration/all/tasmota/discover-http';

// Integrations Bluetooth
import BluetoothDevicePage from '../routes/integration/all/bluetooth/device-page';
import BluetoothEditDevicePage from '../routes/integration/all/bluetooth/edit-page';
import BluetoothSetupPage from '../routes/integration/all/bluetooth/setup-page';
import BluetoothSetupPeripheralPage from '../routes/integration/all/bluetooth/setup-page/setup-peripheral';
import BluetoothSettingsPage from '../routes/integration/all/bluetooth/settings-page';

// EweLink
import EweLinkPage from '../routes/integration/all/ewelink/device-page';
import EweLinkEditPage from '../routes/integration/all/ewelink/edit-page';
import EweLinkDiscoverPage from '../routes/integration/all/ewelink/discover-page';
import EweLinkSetupPage from '../routes/integration/all/ewelink/setup-page';

// Nuki
import NukiPage from '../routes/integration/all/nuki';
import NukiSetupPage from '../routes/integration/all/nuki/setup-page';
import NukiMqttDiscoverPage from '../routes/integration/all/nuki/discover-mqtt';
import NukiHttpDiscoverPage from '../routes/integration/all/nuki/discover-http';

// AI integration
import OpenAIPage from '../routes/integration/all/openai/index';

// Tuya integration
import TuyaPage from '../routes/integration/all/tuya/device-page';
import TuyaEditPage from '../routes/integration/all/tuya/edit-page';
import TuyaSetupPage from '../routes/integration/all/tuya/setup-page';
import TuyaDiscoverPage from '../routes/integration/all/tuya/discover-page';

// Netatmo integration
import NetatmoPage from '../routes/integration/all/netatmo/device-page';
import NetatmoSetupPage from '../routes/integration/all/netatmo/setup-page';
import NetatmoDiscoverPage from '../routes/integration/all/netatmo/discover-page';

// Sonos integration
import SonosDevicePage from '../routes/integration/all/sonos/device-page';
import SonosDiscoveryPage from '../routes/integration/all/sonos/discover-page';

// Google Cast integration
import GoogleCastDevicePage from '../routes/integration/all/google-cast/device-page';
import GoogleCastDiscoveryPage from '../routes/integration/all/google-cast/discover-page';

// Airplay integration
import AirplayDevicePage from '../routes/integration/all/airplay/device-page';
import AirplayDiscoveryPage from '../routes/integration/all/airplay/discover-page';

// ZWaveJS-UI integration
import ZwaveJSUIDevicePage from '../routes/integration/all/zwavejs-ui/device-page';
import ZwaveJSUIDiscoveryPage from '../routes/integration/all/zwavejs-ui/discover-page';
import ZwaveJSUISetupPage from '../routes/integration/all/zwavejs-ui/setup-page';

// Matter integration
import MatterDevices from '../routes/integration/all/matter/MatterDevices';
import MatterDiscoverPage from '../routes/integration/all/matter/MatterDiscoverPage';
import MatterSettingsPage from '../routes/integration/all/matter/MatterSettingsPage';

// MELCloud integration
import MELCloudPage from '../routes/integration/all/melcloud/device-page';
import MELCloudEditPage from '../routes/integration/all/melcloud/edit-page';
import MELCloudSetupPage from '../routes/integration/all/melcloud/setup-page';
import MELCloudDiscoverPage from '../routes/integration/all/melcloud/discover-page';

// NodeRed integration
import NodeRedPage from '../routes/integration/all/node-red/setup-page';

import { USER_ROLE } from '../../../server/utils/constants';

// Matterbridge integration
import MatterbridgePage from '../routes/integration/all/matterbridge/setup-page';

// Free Mobile integration
import FreeMobilePage from '../routes/integration/all/free-mobile';
// CallMeBot integration
import CallMeBotPage from '../routes/integration/all/callmebot/setup-page';

// Energy Monitoring integration
import EnergyMonitoringIntegration from '../routes/integration/all/energy-monitoring/index';

const defaultState = getDefaultState();
const store = createStore(defaultState);

const SafeAsyncRoute = props => (
  <div class="async-route-wrapper">
    <AsyncRoute {...props} loading={() => <div class="loading-placeholder" />} />
  </div>
);

const AppRouter = connect(
  'currentUrl,user,profilePicture,showDropDown,showCollapsedMenu,fullScreen',
  actions
)(props => (
  <div id="app">
    <Layout currentUrl={props.currentUrl}>
      <Header
        currentUrl={props.currentUrl}
        user={props.user}
        fullScreen={props.fullScreen}
        profilePicture={props.profilePicture}
        toggleDropDown={props.toggleDropDown}
        showDropDown={props.showDropDown}
        closeDropDown={props.closeDropDown}
        toggleCollapsedMenu={props.toggleCollapsedMenu}
        showCollapsedMenu={props.showCollapsedMenu}
        logout={props.logout}
      />
      <Router onChange={props.handleRoute}>
        <Redirect path="/" to="/dashboard" />
        {/** ROUTE WHICH ARE DIFFERENT IN GATEWAY MODE */}
        {config.gatewayMode ? <LoginGateway path="/login" /> : <Login path="/login" />}
        {config.gatewayMode ? (
          <GatewayForgotPassword path="/forgot-password" />
        ) : (
          <ForgotPassword path="/forgot-password" />
        )}
        {config.gatewayMode ? (
          <GatewayResetPassword path="/reset-password" />
        ) : (
          <ResetPassword path="/reset-password" />
        )}
        <Locked path="/locked" />
        {config.gatewayMode && <LinkGatewayUser path="/link-gateway-user" />}
        {config.gatewayMode && <SignupGateway path="/signup-gateway" />}
        {config.gatewayMode && <ConfigureTwoFactorGateway path="/gateway-configure-two-factor" />}
        {config.gatewayMode && <GatewayConfirmEmail path="/confirm-email" />}
        {config.gatewayMode && <SettingsBilling path="/dashboard/settings/billing" />}
        {config.gatewayMode && <SettingsGatewayUsers path="/dashboard/settings/gateway-users" />}
        {config.gatewayMode && <SettingsGatewayOpenApi path="/dashboard/settings/gateway-open-api" />}

        {!config.gatewayMode && <SignupWelcomePage path="/signup" />}
        {/** END OF ROUTES WHICH ARE DIFFERENT IN GATEWAY MODE */}
        <SignupCreateAccountLocal path="/signup/create-account-local" />
        <SignupCreateAccountGladysGateway path="/signup/create-account-gladys-gateway" />
        <SignupPreferences path="/signup/preference" />
        <SignupConfigureHouse path="/signup/configure-house" />
        <SignupSuccess path="/signup/success" />
        <SafeAsyncRoute path="/dashboard" component={Dashboard} />
        <SafeAsyncRoute path="/dashboard/:dashboardSelector" component={Dashboard} />
        <EditDashboard path="/dashboard/:dashboardSelector/edit" />
        <NewDashboard path="/dashboard/create/new" />
        <SafeAsyncRoute path="/dashboard/integration" component={IntegrationPage} />

        <IntegrationPage path="/dashboard/integration/favorites" category="favorites" />
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <IntegrationPage path="/dashboard/integration/device" category="device" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        <IntegrationPage path="/dashboard/integration/communication" category="communication" />
        <IntegrationPage path="/dashboard/integration/calendar" category="calendar" />
        <IntegrationPage path="/dashboard/integration/music" category="music" />
        <IntegrationPage path="/dashboard/integration/health" category="health" />
        <IntegrationPage path="/dashboard/integration/weather" category="weather" />
        <IntegrationPage path="/dashboard/integration/navigation" category="navigation" />

        <TelegramPage path="/dashboard/integration/communication/telegram" />
        <Redirect
          path="/dashboard/integration/communication/nextcloudtalk"
          to="/dashboard/integration/communication/nextcloud-talk"
        />
        <NextcloudTalkPage path="/dashboard/integration/communication/nextcloud-talk" />
        <Redirect path="/dashboard/integration/calendar/caldav" to="/dashboard/integration/calendar/caldav/account" />
        <CalDAVAccountPage path="/dashboard/integration/calendar/caldav/account" />
        <CalDAVSyncPage path="/dashboard/integration/calendar/caldav/sync" />
        <CalDAVSharePage path="/dashboard/integration/calendar/caldav/share" />
        <OpenWeatherPage path="/dashboard/integration/weather/openweather" />
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <Redirect
            path="/dashboard/integration/device/philips-hue"
            to="/dashboard/integration/device/philips-hue/device"
          />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <PhilipsHueSetupPage path="/dashboard/integration/device/philips-hue/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <PhilipsHueDevicePage path="/dashboard/integration/device/philips-hue/device" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <Redirect path="/dashboard/integration/device/tp-link" to="/dashboard/integration/device/tp-link/device" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TPLinkDevicePage path="/dashboard/integration/device/tp-link/device" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <RtspCameraPage path="/dashboard/integration/device/rtsp-camera" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MqttDevicePage path="/dashboard/integration/device/mqtt" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MqttDeviceSetupPage path="/dashboard/integration/device/mqtt/edit" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MqttDeviceSetupPage path="/dashboard/integration/device/mqtt/edit/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MqttSetupPage path="/dashboard/integration/device/mqtt/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MqttDebugPage path="/dashboard/integration/device/mqtt/debug" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <Zigbee2mqttPage path="/dashboard/integration/device/zigbee2mqtt" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <Zigbee2mqttDiscoverPage path="/dashboard/integration/device/zigbee2mqtt/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <Zigbee2mqttSetupPage path="/dashboard/integration/device/zigbee2mqtt/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <Zigbee2mqttEditPage path="/dashboard/integration/device/zigbee2mqtt/edit/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NodeRedPage path="/dashboard/integration/device/node-red" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MatterbridgePage path="/dashboard/integration/device/matterbridge" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        <FreeMobilePage path="dashboard/integration/communication/free-mobile" />
        <CallMeBotPage path="dashboard/integration/communication/callmebot" />
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnergyMonitoringIntegration path="/dashboard/integration/device/energy-monitoring" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnergyMonitoringIntegration path="/dashboard/integration/device/energy-monitoring/prices" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnergyMonitoringIntegration path="/dashboard/integration/device/energy-monitoring/prices/create" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnergyMonitoringIntegration path="/dashboard/integration/device/energy-monitoring/prices/import" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnergyMonitoringIntegration path="/dashboard/integration/device/energy-monitoring/prices/edit/:id" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnergyMonitoringIntegration path="/dashboard/integration/device/energy-monitoring/settings" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <XiaomiPage path="/dashboard/integration/device/xiaomi" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EditXiaomiPage path="/dashboard/integration/device/xiaomi/edit/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TasmotaPage path="/dashboard/integration/device/tasmota" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TasmotaEditPage path="/dashboard/integration/device/tasmota/edit/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TasmotaMqttDiscoverPage path="/dashboard/integration/device/tasmota/mqtt" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TasmotaHttpDiscoverPage path="/dashboard/integration/device/tasmota/http" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EweLinkPage path="/dashboard/integration/device/ewelink" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EweLinkEditPage path="/dashboard/integration/device/ewelink/edit/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EweLinkDiscoverPage path="/dashboard/integration/device/ewelink/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EweLinkSetupPage path="/dashboard/integration/device/ewelink/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <HomeKitPage path="/dashboard/integration/communication/homekit" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <OpenAIPage path="/dashboard/integration/communication/openai" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        <MCPPage path="/dashboard/integration/communication/mcp" />

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TuyaPage path="/dashboard/integration/device/tuya" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TuyaEditPage path="/dashboard/integration/device/tuya/edit/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TuyaDiscoverPage path="/dashboard/integration/device/tuya/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <TuyaSetupPage path="/dashboard/integration/device/tuya/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NetatmoPage path="/dashboard/integration/device/netatmo" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NetatmoDiscoverPage path="/dashboard/integration/device/netatmo/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NetatmoSetupPage path="/dashboard/integration/device/netatmo/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SonosDevicePage path="/dashboard/integration/device/sonos" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SonosDiscoveryPage path="/dashboard/integration/device/sonos/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <GoogleCastDevicePage path="/dashboard/integration/device/google-cast" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <GoogleCastDiscoveryPage path="/dashboard/integration/device/google-cast/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <AirplayDevicePage path="/dashboard/integration/device/airplay" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <AirplayDiscoveryPage path="/dashboard/integration/device/airplay/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <ZwaveJSUIDevicePage path="/dashboard/integration/device/zwavejs-ui" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <ZwaveJSUIDiscoveryPage path="/dashboard/integration/device/zwavejs-ui/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <ZwaveJSUISetupPage path="/dashboard/integration/device/zwavejs-ui/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MatterDevices path="/dashboard/integration/device/matter" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MatterDiscoverPage path="/dashboard/integration/device/matter/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MatterSettingsPage path="/dashboard/integration/device/matter/settings" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MELCloudPage path="/dashboard/integration/device/melcloud" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MELCloudEditPage path="/dashboard/integration/device/melcloud/edit/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MELCloudDiscoverPage path="/dashboard/integration/device/melcloud/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <MELCloudSetupPage path="/dashboard/integration/device/melcloud/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NukiPage path="/dashboard/integration/device/nuki" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NukiSetupPage path="/dashboard/integration/device/nuki/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NukiMqttDiscoverPage path="/dashboard/integration/device/nuki/mqtt" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NukiHttpDiscoverPage path="/dashboard/integration/device/nuki/http" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BluetoothDevicePage path="/dashboard/integration/device/bluetooth" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BluetoothEditDevicePage path="/dashboard/integration/device/bluetooth/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BluetoothSetupPage path="/dashboard/integration/device/bluetooth/setup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BluetoothSetupPeripheralPage path="/dashboard/integration/device/bluetooth/setup/:uuid" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BluetoothSettingsPage path="/dashboard/integration/device/bluetooth/config" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BroadlinkDevicePage path="/dashboard/integration/device/broadlink" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BroadlinkRemoteSetupPage path="/dashboard/integration/device/broadlink/edit" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BroadlinkRemoteSetupPage path="/dashboard/integration/device/broadlink/edit/:deviceSelector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <BroadlinkPeripheralPage path="/dashboard/integration/device/broadlink/peripheral" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <LANManagerDevicePage path="/dashboard/integration/device/lan-manager" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <LANManagerDiscoverPage path="/dashboard/integration/device/lan-manager/discover" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <LANManagerSettingsPage path="/dashboard/integration/device/lan-manager/config" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <GoogleHomeWelcomePage path="/dashboard/integration/communication/googlehome" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <GoogleHomeGateway path="/dashboard/integration/device/google-home/authorize" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <AlexaWelcomePage path="/dashboard/integration/communication/alexa" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <AlexaGateway path="/dashboard/integration/device/alexa/authorize" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <OwntracksWelcomePage path="/dashboard/integration/device/owntracks" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnedisGateway path="/dashboard/integration/device/enedis" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnedisGatewayUsagePoints path="/dashboard/integration/device/enedis/usage-points" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EnedisGateway path="/dashboard/integration/device/enedis/redirect" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}

        <SafeAsyncRoute path="/dashboard/history" component={HistoryPage} />
        <SafeAsyncRoute path="/dashboard/chat" component={ChatPage} />
        <SafeAsyncRoute path="/dashboard/maps" component={MapPage} />
        <MapNewAreaPage path="/dashboard/maps/area/new" />
        <MapNewAreaPage path="/dashboard/maps/area/edit/:areaSelector" />
        <SafeAsyncRoute path="/dashboard/calendar" component={CalendarPage} />
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SafeAsyncRoute path="/dashboard/scene" component={ScenePage} />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <NewScenePage path="/dashboard/scene/new" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <DuplicateScenePage path="/dashboard/scene/:scene_selector/duplicate" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <EditScenePage path="/dashboard/scene/:scene_selector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        <SafeAsyncRoute path="/dashboard/profile" component={ProfilePage} />
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsSessionPage path="/dashboard/settings/session" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SafeAsyncRoute path="/dashboard/settings/house" component={SettingsHousePage} />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsUserPage path="/dashboard/settings/user" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsEditUserPage path="/dashboard/settings/user/edit/:user_selector" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsCreateUserPage path="/dashboard/settings/user/new" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsSystemPage path="/dashboard/settings/system" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsGateway path="/dashboard/settings/gateway" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsServicePage path="/dashboard/settings/service" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsBackup path="/dashboard/settings/backup" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        {props.user && props.user.role === USER_ROLE.ADMIN ? (
          <SettingsBackgroundJobs path="/dashboard/settings/jobs" />
        ) : (
          <ErrorNoAuthorize type="403" default />
        )}
        <Error type="404" default />
      </Router>
    </Layout>
  </div>
));

class MainApp extends Component {
  componentWillMount() {
    this.props.checkSession();
  }

  componentDidMount() {
    // Listen for system preference change
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
    prefersDarkMode.addEventListener('change', this.handleSystemPreferenceChange);
  }

  componentWillUnmount() {
    // Remove event listener to prevent memory leaks
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this.handleSystemPreferenceChange);
  }

  handleSystemPreferenceChange = () => {
    // Use the global action to update dark mode state based on system preference
    this.props.updateDarkModeFromSystem();
  };

  render({ user }, {}) {
    const translationDefinition = get(translations, user.language, { default: translations.en });
    return (
      <IntlProvider definition={translationDefinition}>
        <AppRouter />
      </IntlProvider>
    );
  }
}

const MainAppConnected = connect('user', actions)(MainApp);

const App = () => (
  <Provider store={store}>
    <MainAppConnected />
  </Provider>
);

export default App;
