import { Component, createRef } from 'preact';
import { connect } from 'unistore/preact';
import cx from 'classnames';
import { Text } from 'preact-i18n';
import Hls from 'hls.js';

import config from '../../../config';
import {
  WEBSOCKET_MESSAGE_TYPES,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES
} from '../../../../../server/utils/constants';
import get from 'get-value';
import style from './style.css';
import GladysPlusUpsellCard from '../../gateway/GladysPlusUpsellCard';

const SEGMENT_DURATIONS_PER_LATENCY = {
  'ultra-low': 1,
  low: 2,
  medium: 3,
  standard: 6
};

class CameraBoxComponent extends Component {
  videoRef = createRef();
  mediaContainerRef = createRef();
  state = {
    cameraStreamingErrorCount: 0
  };

  refreshData = async () => {
    try {
      const image = await this.props.httpClient.get(`/api/v1/camera/${this.props.box.camera}/image`);
      this.setState({ image, error: false });
    } catch (e) {
      console.error(e);
      this.setState({ error: true });
    }
  };

  getControlFeatures = async () => {
    // Discover the camera control features (PTZ, night mode, detections)
    // so the widget only displays the controls this camera supports
    try {
      const device = await this.props.httpClient.get(`/api/v1/device/${this.props.box.camera}`);
      const cameraFeatures = (device.features || []).filter(
        feature => feature.category === DEVICE_FEATURE_CATEGORIES.CAMERA
      );
      const panFeature = cameraFeatures.find(feature => feature.type === DEVICE_FEATURE_TYPES.CAMERA.PAN);
      const tiltFeature = cameraFeatures.find(feature => feature.type === DEVICE_FEATURE_TYPES.CAMERA.TILT);
      const zoomFeature = cameraFeatures.find(feature => feature.type === DEVICE_FEATURE_TYPES.CAMERA.ZOOM);
      const nightModeFeature = cameraFeatures.find(feature => feature.type === DEVICE_FEATURE_TYPES.CAMERA.NIGHT_MODE);
      // The box always displays the main image of the camera: keep its
      // feature so websocket updates of other image features (label
      // snapshots...) don't overwrite it
      const mainImageFeature = cameraFeatures.find(feature => feature.type === DEVICE_FEATURE_TYPES.CAMERA.IMAGE);
      const detectionFeatures = cameraFeatures.filter(feature => feature.type.endsWith('-detection'));
      const activeDetections = {};
      detectionFeatures.forEach(feature => {
        activeDetections[feature.selector] = feature.last_value === 1;
      });
      this.setState({
        panFeature,
        tiltFeature,
        zoomFeature,
        nightModeFeature,
        nightModeValue: nightModeFeature ? nightModeFeature.last_value : 0,
        mainImageFeature,
        detectionFeatures,
        activeDetections
      });
    } catch (e) {
      console.error(e);
    }
  };

  updateDeviceBinaryStateWebsocket = payload => {
    const { nightModeFeature, detectionFeatures } = this.state;
    if (nightModeFeature && payload.device_feature_selector === nightModeFeature.selector) {
      this.setState({ nightModeValue: payload.last_value });
      return;
    }
    if (detectionFeatures && detectionFeatures.some(feature => feature.selector === payload.device_feature_selector)) {
      this.setState(prevState => ({
        activeDetections: {
          ...prevState.activeDetections,
          [payload.device_feature_selector]: payload.last_value === 1
        }
      }));
    }
  };

  setFeatureValue = async (feature, value) => {
    try {
      await this.props.httpClient.post(`/api/v1/device_feature/${feature.selector}/value`, { value });
    } catch (e) {
      console.error(e);
    }
  };

  togglePtzPanel = () => {
    this.setState(prevState => ({ ptzPanelOpened: !prevState.ptzPanelOpened }));
  };

  toggleFullscreen = () => {
    // Fullscreen on the media container (not the video element) so the PTZ
    // overlay and the detection badges stay visible
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (this.mediaContainerRef.current && this.mediaContainerRef.current.requestFullscreen) {
      this.mediaContainerRef.current.requestFullscreen();
    }
  };

  handleFullscreenChange = () => {
    this.setState({ isFullscreen: document.fullscreenElement === this.mediaContainerRef.current });
  };

  startPtzMove = (feature, direction) => () => {
    this.setFeatureValue(feature, direction);
  };

  stopPtzMove = feature => () => {
    this.setFeatureValue(feature, 0);
  };

  toggleNightMode = async () => {
    const { nightModeFeature, nightModeValue } = this.state;
    const newValue = nightModeValue ? 0 : 1;
    this.setState({ nightModeValue: newValue });
    await this.setFeatureValue(nightModeFeature, newValue);
  };

  handleWebsocketConnected = ({ connected }) => {
    // When the websocket is disconnected, we refresh the data when the websocket is reconnected
    if (!connected) {
      this.wasDisconnected = true;
    } else if (this.wasDisconnected) {
      this.refreshData();
      this.wasDisconnected = false;
    }
  };

  updateDeviceStateWebsocket = payload => {
    if (this.props.box.camera !== payload.device) {
      return;
    }
    // Cameras can expose several image features (last detection snapshots
    // per label...): only the main image feature updates the box, so the
    // displayed format doesn't jump on every detection
    const { mainImageFeature } = this.state;
    if (mainImageFeature && payload.device_feature !== mainImageFeature.selector) {
      return;
    }
    this.setState({
      image: payload.last_value_string,
      error: false
    });
  };

  newNetworkError = () => {
    this.setState(prevState => {
      const { cameraStreamingErrorCount } = prevState;
      return {
        ...prevState,
        cameraStreamingErrorCount: cameraStreamingErrorCount + 1
      };
    });
  };

  startStreaming = async () => {
    if (!Hls.isSupported()) {
      this.setState({ liveNotSupportedBrowser: true });
      return;
    }
    await this.setState({
      streaming: true,
      loading: true,
      liveStartError: false,
      upgradeGladysPlusPlanRequired: false
    });
    try {
      const isGladysPlus = this.props.session.gatewayClient !== undefined;

      const segmentationDuration = this.props.box.camera_latency
        ? SEGMENT_DURATIONS_PER_LATENCY[this.props.box.camera_latency]
        : SEGMENT_DURATIONS_PER_LATENCY.low;

      const [streamingParams, gatewayStreaming] = await Promise.all([
        this.props.httpClient.post(`/api/v1/service/rtsp-camera/camera/${this.props.box.camera}/streaming/start`, {
          origin: isGladysPlus ? config.gladysGatewayApiUrl : config.localApiUrl,
          is_gladys_gateway: isGladysPlus,
          segment_duration: segmentationDuration
        }),
        isGladysPlus ? this.props.session.gatewayClient.cameraStartStreaming() : null
      ]);
      const { localApiUrl } = config;
      const cameraComponent = this;

      this.hls = new Hls({
        liveMaxLatencyDurationCount: 3,
        liveSyncDurationCount: 2,
        maxLiveSyncPlaybackRate: 1.5,
        liveDurationInfinity: true,
        xhrSetup: xhr => {
          // We set the correct access token (locally only)
          // On Gladys Plus, authentication is done with a temporary
          // token in the URL to avoid preflight requests
          if (!isGladysPlus) {
            const accessToken = this.props.session.getAccessToken();
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
          }
        },
        loader: class CustomLoader extends Hls.DefaultConfig.loader {
          load(context, config, callbacks) {
            let { url } = context;

            // For the encryption key, we hot replace the key with the data
            // Coming from Gladys to ensure End-to-End Encryption
            // When using with Gladys Plus
            if (url && url.endsWith('index.m3u8.key')) {
              const onSuccess = callbacks.onSuccess;
              callbacks.onSuccess = function(response, stats, context) {
                const enc = new TextEncoder();
                // Encryption key is replaced here:
                response.data = enc.encode(streamingParams.encryption_key);

                onSuccess(response, stats, context);
              };
            }

            if (url && url.endsWith('index.m3u8')) {
              const onSuccess = callbacks.onSuccess;
              callbacks.onSuccess = function(response, stats, context) {
                cameraComponent.setState({ cameraStreamingErrorCount: 0 });

                if (!isGladysPlus) {
                  // In the index.m3u8, we replace the backend URL with the local API file
                  // This is useful for local streaming only
                  response.data = response.data.replace('BACKEND_URL_TO_REPLACE', localApiUrl);
                } else {
                  // We add the stream access key to the URL for authentication
                  response.data = response.data.replace(
                    '/index.m3u8.key',
                    `/${gatewayStreaming.stream_access_key}/index.m3u8.key`
                  );
                }

                onSuccess(response, stats, context);
              };
            }

            super.load(context, config, callbacks);
          }
        }
      });
      this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {});
      this.hls.on(Hls.Events.ERROR, (event, data) => {
        console.error(event, data);
        const errorType = data.type;
        const errorDetails = data.details;
        const errorFatal = data.fatal;
        const response = data.response;
        console.error(errorType);
        console.error(errorDetails);
        console.error(errorFatal);
        if (errorType === 'networkError') {
          this.newNetworkError();
        }
        if (response && response.code === 429) {
          this.setState({ liveTooManyRequestsError: true });
          this.stopStreaming();
        }
      });
      if (isGladysPlus) {
        this.hls.loadSource(
          `${config.gladysGatewayApiUrl}/cameras/${streamingParams.camera_folder}/${gatewayStreaming.stream_access_key}/index.m3u8`
        );
      } else {
        this.hls.loadSource(
          `${config.localApiUrl}/api/v1/service/rtsp-camera/camera/streaming/${streamingParams.camera_folder}/index.m3u8`
        );
      }

      if (this.liveActiveInterval) {
        clearInterval(this.liveActiveInterval);
      }

      // Every 3 seconds, sends a ping to Gladys to tell Gladys the live is still active
      this.liveActiveInterval = setInterval(this.liveActivePing, 3000);

      // bind them together
      this.hls.attachMedia(this.videoRef.current);
    } catch (e) {
      const status = get(e, 'response.status');
      if (status === 402) {
        this.setState({ upgradeGladysPlusPlanRequired: true });
      } else {
        this.setState({ liveStartError: true });
      }

      console.error(e);
      await this.stopStreaming();
    }
    await this.setState({ loading: false });
  };

  stopStreaming = async () => {
    await this.setState({ loading: true });

    // We clear the live active interval
    // The streaming will be automatically stopped
    // After some time
    if (this.liveActiveInterval) {
      clearInterval(this.liveActiveInterval);
    }

    if (this.hls) {
      this.hls.stopLoad();
      this.hls.detachMedia();
      this.hls.destroy();
      delete this.hls;
    }

    await this.setState({ streaming: false, loading: false });
  };

  liveActivePing = async () => {
    try {
      await this.props.httpClient.post(`/api/v1/service/rtsp-camera/camera/${this.props.box.camera}/streaming/ping`);
    } catch (e) {
      console.error(e);
      // If the ping fails, it means the stream ended. We stop the stream.
      this.stopStreaming();
    }
  };

  componentDidMount() {
    this.refreshData();
    this.getControlFeatures();
    if (this.props.box.camera_live_auto_start === true) {
      this.startStreaming();
    }
    this.props.session.dispatcher.addListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STRING_STATE,
      this.updateDeviceStateWebsocket
    );
    this.props.session.dispatcher.addListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE,
      this.updateDeviceBinaryStateWebsocket
    );
    this.props.session.dispatcher.addListener('websocket.connected', this.handleWebsocketConnected);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  componentDidUpdate(previousProps) {
    const cameraChanged = get(previousProps, 'box.camera') !== get(this.props, 'box.camera');
    const nameChanged = get(previousProps, 'box.name') !== get(this.props, 'box.name');
    if (cameraChanged || nameChanged) {
      this.refreshData();
      this.getControlFeatures();
    }
  }

  componentWillUnmount() {
    this.props.session.dispatcher.removeListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STRING_STATE,
      this.updateDeviceStateWebsocket
    );
    this.props.session.dispatcher.removeListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STATE,
      this.updateDeviceBinaryStateWebsocket
    );
    if (this.state.streaming) {
      this.stopStreaming();
    }
    this.props.session.dispatcher.removeListener('websocket.connected', this.handleWebsocketConnected);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  renderDetectionBadges() {
    const { detectionFeatures, activeDetections } = this.state;
    const activeFeatures = (detectionFeatures || []).filter(feature => activeDetections[feature.selector]);
    if (activeFeatures.length === 0) {
      return null;
    }
    return (
      <div class={style.detectionBadges}>
        {activeFeatures.map(feature => (
          <span class="tag tag-danger">
            <Text id={`deviceFeatureCategory.camera.${feature.type}`} />
          </span>
        ))}
      </div>
    );
  }

  renderPtzOverlay() {
    const { panFeature, tiltFeature, zoomFeature } = this.state;
    return (
      <div class={style.ptzOverlay}>
        <div class={style.ptzPad}>
          {tiltFeature && (
            <div class={style.ptzRow}>
              <button
                class="btn btn-secondary btn-sm"
                onMouseDown={this.startPtzMove(tiltFeature, 1)}
                onMouseUp={this.stopPtzMove(tiltFeature)}
                onMouseLeave={this.stopPtzMove(tiltFeature)}
                onTouchStart={this.startPtzMove(tiltFeature, 1)}
                onTouchEnd={this.stopPtzMove(tiltFeature)}
              >
                <i class="fe fe-arrow-up" />
              </button>
            </div>
          )}
          <div class={style.ptzRow}>
            {panFeature && (
              <button
                class="btn btn-secondary btn-sm"
                onMouseDown={this.startPtzMove(panFeature, -1)}
                onMouseUp={this.stopPtzMove(panFeature)}
                onMouseLeave={this.stopPtzMove(panFeature)}
                onTouchStart={this.startPtzMove(panFeature, -1)}
                onTouchEnd={this.stopPtzMove(panFeature)}
              >
                <i class="fe fe-arrow-left" />
              </button>
            )}
            <button class="btn btn-secondary btn-sm" onClick={this.togglePtzPanel}>
              <i class="fe fe-x" />
            </button>
            {panFeature && (
              <button
                class="btn btn-secondary btn-sm"
                onMouseDown={this.startPtzMove(panFeature, 1)}
                onMouseUp={this.stopPtzMove(panFeature)}
                onMouseLeave={this.stopPtzMove(panFeature)}
                onTouchStart={this.startPtzMove(panFeature, 1)}
                onTouchEnd={this.stopPtzMove(panFeature)}
              >
                <i class="fe fe-arrow-right" />
              </button>
            )}
          </div>
          {tiltFeature && (
            <div class={style.ptzRow}>
              <button
                class="btn btn-secondary btn-sm"
                onMouseDown={this.startPtzMove(tiltFeature, -1)}
                onMouseUp={this.stopPtzMove(tiltFeature)}
                onMouseLeave={this.stopPtzMove(tiltFeature)}
                onTouchStart={this.startPtzMove(tiltFeature, -1)}
                onTouchEnd={this.stopPtzMove(tiltFeature)}
              >
                <i class="fe fe-arrow-down" />
              </button>
            </div>
          )}
          {zoomFeature && (
            <div class={style.ptzRow}>
              <button
                class="btn btn-secondary btn-sm"
                onMouseDown={this.startPtzMove(zoomFeature, -1)}
                onMouseUp={this.stopPtzMove(zoomFeature)}
                onMouseLeave={this.stopPtzMove(zoomFeature)}
                onTouchStart={this.startPtzMove(zoomFeature, -1)}
                onTouchEnd={this.stopPtzMove(zoomFeature)}
              >
                <i class="fe fe-zoom-out" />
              </button>
              <button
                class="btn btn-secondary btn-sm"
                onMouseDown={this.startPtzMove(zoomFeature, 1)}
                onMouseUp={this.stopPtzMove(zoomFeature)}
                onMouseLeave={this.stopPtzMove(zoomFeature)}
                onTouchStart={this.startPtzMove(zoomFeature, 1)}
                onTouchEnd={this.stopPtzMove(zoomFeature)}
              >
                <i class="fe fe-zoom-in" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  renderControlButtons(streaming) {
    const { panFeature, tiltFeature, nightModeFeature, nightModeValue, isFullscreen } = this.state;
    return (
      <span>
        {nightModeFeature && (
          <button
            class={cx('btn btn-sm mr-2', {
              'btn-dark': nightModeValue,
              'btn-secondary': !nightModeValue
            })}
            onClick={this.toggleNightMode}
          >
            <i class="fe fe-moon" />
          </button>
        )}
        {streaming && (panFeature || tiltFeature) && (
          <button class="btn btn-secondary btn-sm mr-2" onClick={this.togglePtzPanel}>
            <i class="fe fe-move" />
          </button>
        )}
        {streaming && (
          <button class="btn btn-secondary btn-sm mr-2" onClick={this.toggleFullscreen}>
            <i class={cx('fe', isFullscreen ? 'fe-minimize' : 'fe-maximize')} />
          </button>
        )}
      </span>
    );
  }

  renderFullscreenToolbar() {
    // The dashboard card header is not part of the fullscreen element:
    // repeat the control buttons inside the media container so night mode,
    // PTZ and exit stay accessible in fullscreen
    return <div class={style.fullscreenToolbar}>{this.renderControlButtons(true)}</div>;
  }

  render(
    props,
    {
      image,
      error,
      streaming,
      loading,
      liveStartError,
      liveNotSupportedBrowser,
      liveTooManyRequestsError,
      upgradeGladysPlusPlanRequired,
      ptzPanelOpened
    }
  ) {
    if (streaming) {
      return (
        <div class="card">
          <div
            class={cx('dimmer card-img-top', {
              active: loading
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              <div class={style.cameraMediaContainer} ref={this.mediaContainerRef}>
                <video class="w-100" ref={this.videoRef} controls controlslist="nofullscreen" autoPlay muted />
                {this.renderDetectionBadges()}
                {ptzPanelOpened && this.renderPtzOverlay()}
                {this.state.isFullscreen && this.renderFullscreenToolbar()}
              </div>
            </div>
          </div>
          <div class="card-header">
            <h3 class="card-title">{props.box && props.box.name}</h3>
            <div class="card-options">
              {this.renderControlButtons(true)}
              <button class="btn btn-primary btn-sm" onClick={this.stopStreaming}>
                <i class="fe fe-pause" />
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div class="card">
        <div class={style.cameraMediaContainer}>
          {image && <img class="card-img-top" src={`data:${image}`} alt={props.roomName} />}
          {this.renderDetectionBadges()}
        </div>
        {error && (
          <div>
            <p class={style.noImageToShowError}>
              <span class="pl-2">
                <Text id="dashboard.boxes.camera.noImageToShow" />
              </span>
            </p>
          </div>
        )}
        {!image && loading && (
          <div class="dimmer active">
            <div class="dimmer-content my-5 py-5" />
            <div class="loader" />
          </div>
        )}
        {liveStartError && (
          <div>
            <p class="alert alert-danger">
              <i class="fe fe-bell" />
              <span class="pl-2">
                <Text id="dashboard.boxes.camera.liveStartError" />
              </span>
            </p>
          </div>
        )}
        {upgradeGladysPlusPlanRequired && (
          <div class="p-2">
            <GladysPlusUpsellCard
              variant="upgrade"
              icon="fe-video"
              utmCampaign="dashboard_camera_upgrade"
              titleKey="gladysPlusUpsell.camera.upgradeTitle"
              descriptionKey="gladysPlusUpsell.camera.upgradeDescription"
            />
          </div>
        )}
        {liveNotSupportedBrowser && (
          <div>
            <p class="alert alert-warning">
              <i class="fe fe-compass" />
              <span class="pl-2">
                <Text id="dashboard.boxes.camera.notNotSupportedBrowser" />
              </span>
            </p>
          </div>
        )}
        {liveTooManyRequestsError && (
          <div>
            <p class="alert alert-warning">
              <i class="fe fe-alert-triangle" />
              <span class="pl-2">
                <Text id="dashboard.boxes.camera.tooManyRequests" />
              </span>
            </p>
          </div>
        )}
        <div class="card-header">
          <h3 class="card-title">{props.box && props.box.name}</h3>
          <div class="card-options">
            {this.renderControlButtons(false)}
            <button class="btn btn-secondary btn-sm" onClick={this.startStreaming}>
              <i class="fe fe-airplay" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient,session', {})(CameraBoxComponent);
