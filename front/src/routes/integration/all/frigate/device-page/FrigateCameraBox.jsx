import { Text, Localizer } from 'preact-i18n';
import { Component } from 'preact';
import cx from 'classnames';
import { RequestStatus } from '../../../../../utils/consts';
import { DEVICE_POLL_FREQUENCIES } from '../../../../../../../server/utils/constants';
import { SOURCE_TYPES, TRACKABLE_LABELS } from '../../../../../../../server/services/frigate/lib/constants';

class FrigateCameraBox extends Component {
  saveCamera = async () => {
    this.setState({
      loading: true
    });
    try {
      await this.props.saveCamera(this.props.cameraIndex);
      this.setState({
        saveError: null
      });
    } catch (e) {
      this.setState({
        saveError: RequestStatus.Error
      });
    }
    this.setState({
      loading: false
    });
  };
  deleteCamera = async () => {
    this.setState({
      loading: true
    });
    try {
      await this.props.deleteCamera(this.props.cameraIndex);
    } catch (e) {
      this.setState({
        error: RequestStatus.Error
      });
    }
    this.setState({
      loading: false
    });
  };
  updateCameraName = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'name', e.target.value);
  };
  updateCameraRoom = e => {
    const newRoom = e.target.value === '' ? null : e.target.value;
    this.props.updateCameraField(this.props.cameraIndex, 'room_id', newRoom);
  };
  updatePollFrequency = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'poll_frequency', parseInt(e.target.value, 10));
  };
  updateSourceType = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'sourceType', e.target.value);
  };
  updateHost = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'host', e.target.value);
  };
  updateUsername = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'username', e.target.value);
  };
  updatePassword = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'password', e.target.value);
  };
  updatePath = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'path', e.target.value);
  };
  updateExtra = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'extra', e.target.value);
  };
  updateCustomSource = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'customSource', e.target.value);
  };
  toggleLabel = e => {
    this.props.toggleCameraLabel(this.props.cameraIndex, e.target.value);
  };
  togglePassword = () => {
    this.setState({ showPassword: !this.state.showPassword });
  };

  render(props, { loading, saveError, showPassword }) {
    const { camera } = props;
    return (
      <div class="col-lg-6">
        <div class="card">
          <div
            class={cx('dimmer', {
              active: loading
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              <div class="card-body">
                {saveError && (
                  <div class="alert alert-danger">
                    <Text id="integration.frigate.device.saveError" />
                  </div>
                )}
                <div class="form-group">
                  <label>
                    <Text id="integration.frigate.device.nameLabel" />
                  </label>
                  <Localizer>
                    <input
                      type="text"
                      value={camera.name}
                      onInput={this.updateCameraName}
                      class="form-control"
                      placeholder={<Text id="integration.frigate.device.namePlaceholder" />}
                    />
                  </Localizer>
                </div>
                <div class="form-group">
                  <label>
                    <Text id="integration.frigate.device.roomLabel" />
                  </label>
                  <select onChange={this.updateCameraRoom} class="form-control">
                    <option value="">
                      <Text id="global.emptySelectOption" />
                    </option>
                    {props.housesWithRooms &&
                      props.housesWithRooms.map(house => (
                        <optgroup label={house.name}>
                          {house.rooms.map(room => (
                            <option selected={room.id === camera.room_id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                </div>
                <div class="form-group">
                  <label>
                    <Text id="integration.frigate.device.sourceTypeLabel" />
                  </label>
                  <select onChange={this.updateSourceType} value={camera.sourceType} class="form-control">
                    <option value={SOURCE_TYPES.RTSP}>
                      <Text id="integration.frigate.device.sourceTypes.rtsp" />
                    </option>
                    <option value={SOURCE_TYPES.TAPO}>
                      <Text id="integration.frigate.device.sourceTypes.tapo" />
                    </option>
                    <option value={SOURCE_TYPES.CUSTOM}>
                      <Text id="integration.frigate.device.sourceTypes.custom" />
                    </option>
                  </select>
                  {camera.sourceType === SOURCE_TYPES.TAPO && (
                    <div class="help-block">
                      <Text id="integration.frigate.device.tapoHelp" />
                    </div>
                  )}
                </div>
                {camera.sourceType !== SOURCE_TYPES.CUSTOM && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.hostLabel" />
                    </label>
                    <Localizer>
                      <input
                        type="text"
                        value={camera.host}
                        onInput={this.updateHost}
                        class="form-control"
                        placeholder={<Text id="integration.frigate.device.hostPlaceholder" />}
                      />
                    </Localizer>
                    <div class="help-block">
                      <Text id="integration.frigate.device.hostHelp" />
                    </div>
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.RTSP && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.usernameLabel" />
                    </label>
                    <input type="text" value={camera.username} onInput={this.updateUsername} class="form-control" />
                  </div>
                )}
                {camera.sourceType !== SOURCE_TYPES.CUSTOM && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.passwordLabel" />
                    </label>
                    <div class="input-icon">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={camera.password}
                        onInput={this.updatePassword}
                        class="form-control"
                      />
                      <span class="input-icon-addon cursor-pointer" onClick={this.togglePassword}>
                        <i
                          class={cx('fe', {
                            'fe-eye': !showPassword,
                            'fe-eye-off': showPassword
                          })}
                        />
                      </span>
                    </div>
                    {camera.sourceType === SOURCE_TYPES.TAPO && (
                      <div class="help-block">
                        <Text id="integration.frigate.device.tapoPasswordHelp" />
                      </div>
                    )}
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.RTSP && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.pathLabel" />
                    </label>
                    <Localizer>
                      <input
                        type="text"
                        value={camera.path}
                        onInput={this.updatePath}
                        class="form-control"
                        placeholder={<Text id="integration.frigate.device.pathPlaceholder" />}
                      />
                    </Localizer>
                    <div class="help-block">
                      <Text id="integration.frigate.device.pathHelp" />
                    </div>
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.TAPO && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.extraLabel" />
                    </label>
                    <select
                      onChange={this.updateExtra}
                      value={camera.extra || 'channel=0&subtype=1'}
                      class="form-control"
                    >
                      <option value="channel=0&subtype=1">
                        <Text id="integration.frigate.device.extraSubStream" />
                      </option>
                      <option value="channel=0&subtype=0">
                        <Text id="integration.frigate.device.extraMainStream" />
                      </option>
                    </select>
                    <div class="help-block">
                      <Text id="integration.frigate.device.extraHelp" />
                    </div>
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.CUSTOM && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.customSourceLabel" />
                    </label>
                    <Localizer>
                      <input
                        type="text"
                        value={camera.customSource}
                        onInput={this.updateCustomSource}
                        class="form-control"
                        placeholder={<Text id="integration.frigate.device.customSourcePlaceholder" />}
                      />
                    </Localizer>
                    <div class="help-block">
                      <Text id="integration.frigate.device.customSourceHelp" />
                    </div>
                  </div>
                )}
                <div class="form-group">
                  <label>
                    <Text id="integration.frigate.device.labelsLabel" />
                  </label>
                  <div class="row">
                    {TRACKABLE_LABELS.map(label => (
                      <div class="col-6">
                        <label class="custom-control custom-checkbox">
                          <input
                            type="checkbox"
                            class="custom-control-input"
                            value={label}
                            checked={camera.labels.includes(label)}
                            onChange={this.toggleLabel}
                          />
                          <span class="custom-control-label">
                            <Text id={`integration.frigate.device.labels.${label}`} />
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div class="form-group">
                  <label>
                    <Text id="integration.frigate.device.pollFrequencyLabel" />
                  </label>
                  <select onChange={this.updatePollFrequency} value={camera.poll_frequency} class="form-control">
                    <option value={DEVICE_POLL_FREQUENCIES.EVERY_MINUTES}>
                      <Text id="integration.frigate.device.everyMinutes" />
                    </option>
                    <option value={DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS}>
                      <Text id="integration.frigate.device.every30Seconds" />
                    </option>
                    <option value={DEVICE_POLL_FREQUENCIES.EVERY_10_SECONDS}>
                      <Text id="integration.frigate.device.every10Seconds" />
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <button onClick={this.saveCamera} class="btn btn-success mr-2">
                    <Text id="integration.frigate.device.saveButton" />
                  </button>
                  <button onClick={this.deleteCamera} class="btn btn-danger">
                    <Text id="integration.frigate.device.deleteButton" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
export default FrigateCameraBox;
