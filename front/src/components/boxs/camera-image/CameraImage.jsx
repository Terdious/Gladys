import { Component, createRef } from 'preact';
import { connect } from 'unistore/preact';
import cx from 'classnames';
import { Text } from 'preact-i18n';

import {
  WEBSOCKET_MESSAGE_TYPES,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES
} from '../../../../../server/utils/constants';
import RelativeTime from '../../device/RelativeTime';
import style from './style.css';

class CameraImageBoxComponent extends Component {
  mediaContainerRef = createRef();
  state = {};

  refreshData = async () => {
    try {
      // The box displays one specific image feature of the camera (the last
      // detection snapshot of a label...), defaulting to the main image
      const featureQuery = this.props.box.camera_feature ? `?feature=${this.props.box.camera_feature}` : '';
      const image = await this.props.httpClient.get(`/api/v1/camera/${this.props.box.camera}/image${featureQuery}`);
      this.setState({ image, error: false });
    } catch (e) {
      console.error(e);
      this.setState({ error: true });
    }
  };

  getImageFeature = async () => {
    // The feature gives the date of the displayed image, refreshed by websocket updates
    try {
      const device = await this.props.httpClient.get(`/api/v1/device/${this.props.box.camera}`);
      const imageFeatures = (device.features || []).filter(
        feature =>
          feature.category === DEVICE_FEATURE_CATEGORIES.CAMERA && feature.type === DEVICE_FEATURE_TYPES.CAMERA.IMAGE
      );
      const imageFeature = this.props.box.camera_feature
        ? imageFeatures.find(feature => feature.selector === this.props.box.camera_feature)
        : imageFeatures[0];
      if (imageFeature) {
        this.setState({ imageFeature, lastValueChanged: imageFeature.last_value_changed });
      }
    } catch (e) {
      console.error(e);
    }
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
    const { imageFeature } = this.state;
    const targetFeature = this.props.box.camera_feature || (imageFeature && imageFeature.selector);
    if (targetFeature && payload.device_feature !== targetFeature) {
      return;
    }
    this.setState({
      image: payload.last_value_string,
      lastValueChanged: payload.last_value_changed,
      error: false
    });
  };

  toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (this.mediaContainerRef.current && this.mediaContainerRef.current.requestFullscreen) {
      this.mediaContainerRef.current.requestFullscreen();
    }
  };

  handleFullscreenChange = () => {
    this.setState({ isFullscreen: document.fullscreenElement === this.mediaContainerRef.current });
  };

  componentDidMount() {
    this.refreshData();
    this.getImageFeature();
    this.props.session.dispatcher.addListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STRING_STATE,
      this.updateDeviceStateWebsocket
    );
    this.props.session.dispatcher.addListener('websocket.connected', this.handleWebsocketConnected);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  componentDidUpdate(previousProps) {
    const cameraChanged = previousProps.box.camera !== this.props.box.camera;
    const featureChanged = previousProps.box.camera_feature !== this.props.box.camera_feature;
    if (cameraChanged || featureChanged) {
      this.refreshData();
      this.getImageFeature();
    }
  }

  componentWillUnmount() {
    this.props.session.dispatcher.removeListener(
      WEBSOCKET_MESSAGE_TYPES.DEVICE.NEW_STRING_STATE,
      this.updateDeviceStateWebsocket
    );
    this.props.session.dispatcher.removeListener('websocket.connected', this.handleWebsocketConnected);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  render(props, { image, error, lastValueChanged, isFullscreen }) {
    return (
      <div class="card">
        <div class={style.cameraImageContainer} ref={this.mediaContainerRef}>
          {image && <img src={`data:${image}`} alt={props.box.name} />}
          {isFullscreen && (
            <div class={style.fullscreenToolbar}>
              <button class="btn btn-secondary btn-sm" onClick={this.toggleFullscreen}>
                <i class="fe fe-minimize" />
              </button>
            </div>
          )}
        </div>
        {error && (
          <p class={style.noImageToShowError}>
            <span class="pl-2">
              <Text id="dashboard.boxes.camera.noImageToShow" />
            </span>
          </p>
        )}
        <div class="card-header">
          <h3 class={cx('card-title', style.cameraImageTitle)}>
            {props.box && props.box.name}
            {lastValueChanged && (
              <small class="text-muted ml-2">
                <RelativeTime datetime={lastValueChanged} language={props.user && props.user.language} futureDisabled />
              </small>
            )}
          </h3>
          <div class="card-options">
            <button class="btn btn-secondary btn-sm" onClick={this.toggleFullscreen}>
              <i class="fe fe-maximize" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient,session,user', {})(CameraImageBoxComponent);
