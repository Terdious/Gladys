import { Text, Localizer, withText } from 'preact-i18n';
import { Component } from 'preact';
import cx from 'classnames';
import Select from 'react-select';
import { RequestStatus } from '../../../../../utils/consts';
import { DEVICE_POLL_FREQUENCIES } from '../../../../../../../server/utils/constants';
import { SOURCE_TYPES, TRACKABLE_LABELS } from '../../../../../../../server/services/frigate/lib/constants';
import { CAMERA_CATALOG } from '../../../../../../../server/services/frigate/lib/cameraCatalog';

const OTHER_VALUE = 'other';
const GITHUB_ISSUE_URL = `https://github.com/GladysAssistant/Gladys/issues/new?title=${encodeURIComponent(
  'Frigate camera catalog: [brand] [model]'
)}`;

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
  updateSubPath = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'subPath', e.target.value);
  };
  updateCustomSubSource = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'customSubSource', e.target.value);
  };
  updateExtra = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'extra', e.target.value);
  };
  updateTapoAuthVariant = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'tapoAuthVariant', e.target.value);
  };
  updateRtspPort = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'rtspPort', e.target.value);
  };
  updateHttpPort = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'httpPort', e.target.value);
  };
  updateOnvifPort = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'onvifPort', e.target.value);
  };
  updateOnvifUsername = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'onvifUsername', e.target.value);
  };
  updateOnvifPassword = e => {
    this.props.updateCameraField(this.props.cameraIndex, 'onvifPassword', e.target.value);
  };
  toggleOnvifPassword = () => {
    this.setState({ showOnvifPassword: !this.state.showOnvifPassword });
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
  onBrandChange = option => {
    this.props.applyCameraPreset(this.props.cameraIndex, option.value, null, null);
  };
  onModelChange = option => {
    const brand = CAMERA_CATALOG.find(catalogBrand => catalogBrand.key === this.props.camera.catalogBrand);
    const model = brand && brand.models.find(catalogModel => catalogModel.name === option.value);
    this.props.applyCameraPreset(
      this.props.cameraIndex,
      this.props.camera.catalogBrand,
      option.value,
      model ? model.preset : null
    );
  };
  renderRemoteCamera(props, { loading, saveError }, cameraStats) {
    const { camera } = props;
    // Imported from a remote Frigate: Gladys only chooses which detection
    // features it follows, everything else belongs to the remote instance
    const remoteLabels = camera.remoteLabels && camera.remoteLabels.length > 0 ? camera.remoteLabels : camera.labels;
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
                {cameraStats && (
                  <div class="form-group">
                    <span class={cameraStats.camera_fps > 0 ? 'tag tag-success' : 'tag tag-danger'}>
                      {cameraStats.camera_fps > 0 ? (
                        <Text
                          id="integration.frigate.device.streamActive"
                          fields={{ fps: Math.round(cameraStats.camera_fps) }}
                        />
                      ) : (
                        <Text id="integration.frigate.device.streamInactive" />
                      )}
                    </span>
                  </div>
                )}
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
                {camera.remoteSourceHost && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.remoteSourceHostLabel" />
                    </label>
                    <input type="text" value={camera.remoteSourceHost} class="form-control" disabled />
                  </div>
                )}
                <div class="form-group">
                  <label>
                    <Text id="integration.frigate.device.labelsLabel" />
                  </label>
                  <div class="row">
                    {remoteLabels.map(label => (
                      <div class="col-6">
                        <label class="custom-control custom-checkbox">
                          <input
                            type="checkbox"
                            class="custom-control-input"
                            value={label}
                            checked={camera.labels.includes(label)}
                            onClick={this.toggleLabel}
                          />
                          <span class="custom-control-label">
                            <Text id={`integration.frigate.device.labels.${label}`}>{label}</Text>
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <div class="help-block">
                    <Text id="integration.frigate.device.remoteLabelsHelp" />
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

  render(props, { loading, saveError, showPassword, showOnvifPassword }) {
    const { camera } = props;
    const cameraName = camera.external_id ? camera.external_id.split(':')[1] : null;
    const cameraStats =
      props.frigateStats && props.frigateStats.cameras && cameraName ? props.frigateStats.cameras[cameraName] : null;
    if (camera.sourceType === 'remote') {
      return this.renderRemoteCamera(props, { loading, saveError }, cameraStats);
    }
    const selectedBrand = CAMERA_CATALOG.find(catalogBrand => catalogBrand.key === camera.catalogBrand);
    const selectedModel =
      selectedBrand && selectedBrand.models.find(catalogModel => catalogModel.name === camera.catalogModel);
    const brandOptions = [
      ...CAMERA_CATALOG.map(catalogBrand => ({ value: catalogBrand.key, label: catalogBrand.brand })),
      { value: OTHER_VALUE, label: props.otherBrandText }
    ];
    const modelOptions = selectedBrand
      ? [
          ...selectedBrand.models.map(catalogModel => ({ value: catalogModel.name, label: catalogModel.name })),
          { value: OTHER_VALUE, label: props.otherModelText }
        ]
      : [];
    // The catalog constrains which source types make sense for a known model
    const allowedSourceTypes = selectedModel ? selectedModel.allowedSourceTypes : Object.values(SOURCE_TYPES);
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
                {cameraStats && (
                  <div class="form-group">
                    <span class={cameraStats.camera_fps > 0 ? 'tag tag-success' : 'tag tag-danger'}>
                      {cameraStats.camera_fps > 0 ? (
                        <Text
                          id="integration.frigate.device.streamActive"
                          fields={{ fps: Math.round(cameraStats.camera_fps) }}
                        />
                      ) : (
                        <Text id="integration.frigate.device.streamInactive" />
                      )}
                    </span>
                  </div>
                )}
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
                    <Text id="integration.frigate.device.catalog.brandLabel" />
                  </label>
                  <Select
                    options={brandOptions}
                    value={brandOptions.find(option => option.value === camera.catalogBrand) || null}
                    onChange={this.onBrandChange}
                    placeholder={props.brandPlaceholderText}
                  />
                </div>
                {camera.catalogBrand && camera.catalogBrand !== OTHER_VALUE && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.catalog.modelLabel" />
                    </label>
                    <Select
                      options={modelOptions}
                      value={modelOptions.find(option => option.value === camera.catalogModel) || null}
                      onChange={this.onModelChange}
                      placeholder={props.modelPlaceholderText}
                    />
                  </div>
                )}
                {selectedModel && (
                  <div class="alert alert-secondary">
                    <Text id={`integration.frigate.device.catalog.notes.${selectedModel.noteKey}`} />
                  </div>
                )}
                {selectedBrand && camera.catalogModel === OTHER_VALUE && (
                  <div class="alert alert-secondary">
                    <Text id={`integration.frigate.device.catalog.notes.${selectedBrand.unknownModelNoteKey}`} />
                    <div class="mt-2">
                      <a
                        href={GITHUB_ISSUE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn btn-sm btn-outline-primary"
                      >
                        <Text id="integration.frigate.device.catalog.openIssue" />
                      </a>
                    </div>
                  </div>
                )}
                {camera.catalogBrand === OTHER_VALUE && (
                  <div class="alert alert-secondary">
                    <Text id="integration.frigate.device.catalog.unknownBrandNote" />
                    <div class="mt-2">
                      <a
                        href={GITHUB_ISSUE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn btn-sm btn-outline-primary"
                      >
                        <Text id="integration.frigate.device.catalog.openIssue" />
                      </a>
                    </div>
                  </div>
                )}
                <div class="form-group">
                  <label>
                    <Text id="integration.frigate.device.sourceTypeLabel" />
                  </label>
                  <select onChange={this.updateSourceType} value={camera.sourceType} class="form-control">
                    {allowedSourceTypes.map(sourceType => (
                      <option value={sourceType}>
                        <Text id={`integration.frigate.device.sourceTypes.${sourceType}`} />
                      </option>
                    ))}
                  </select>
                  {camera.sourceType === SOURCE_TYPES.TAPO && (
                    <div class="help-block">
                      <Text id="integration.frigate.device.tapoHelp" />
                    </div>
                  )}
                  {camera.sourceType === SOURCE_TYPES.ONVIF && (
                    <div class="help-block">
                      <Text id="integration.frigate.device.onvifHelp" />
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
                      <Text id="integration.frigate.device.rtspPortLabel" />
                    </label>
                    <input
                      type="number"
                      value={camera.rtspPort}
                      onInput={this.updateRtspPort}
                      class="form-control"
                      placeholder="554"
                    />
                    <div class="help-block">
                      <Text id="integration.frigate.device.portHelp" />
                    </div>
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.ONVIF && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.onvifPortLabel" />
                    </label>
                    <input
                      type="number"
                      value={camera.onvifPort}
                      onInput={this.updateOnvifPort}
                      class="form-control"
                      placeholder="80"
                    />
                    <div class="help-block">
                      <Text id="integration.frigate.device.portHelp" />
                    </div>
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.MJPEG && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.httpPortLabel" />
                    </label>
                    <input
                      type="number"
                      value={camera.httpPort}
                      onInput={this.updateHttpPort}
                      class="form-control"
                      placeholder="80"
                    />
                    <div class="help-block">
                      <Text id="integration.frigate.device.portHelp" />
                    </div>
                  </div>
                )}
                {(camera.sourceType === SOURCE_TYPES.RTSP || camera.sourceType === SOURCE_TYPES.MJPEG) && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.usernameLabel" />
                    </label>
                    <input type="text" value={camera.username} onInput={this.updateUsername} class="form-control" />
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.ONVIF && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.usernameLabel" />
                    </label>
                    <input
                      type="text"
                      value={camera.onvifUsername}
                      onInput={this.updateOnvifUsername}
                      class="form-control"
                    />
                  </div>
                )}
                {(camera.sourceType === SOURCE_TYPES.RTSP ||
                  camera.sourceType === SOURCE_TYPES.TAPO ||
                  camera.sourceType === SOURCE_TYPES.MJPEG) && (
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
                {camera.sourceType === SOURCE_TYPES.ONVIF && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.passwordLabel" />
                    </label>
                    <div class="input-icon">
                      <input
                        type={showOnvifPassword ? 'text' : 'password'}
                        value={camera.onvifPassword}
                        onInput={this.updateOnvifPassword}
                        class="form-control"
                      />
                      <span class="input-icon-addon cursor-pointer" onClick={this.toggleOnvifPassword}>
                        <i
                          class={cx('fe', {
                            'fe-eye': !showOnvifPassword,
                            'fe-eye-off': showOnvifPassword
                          })}
                        />
                      </span>
                    </div>
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.TAPO && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.tapoAuthVariantLabel" />
                    </label>
                    <select
                      onChange={this.updateTapoAuthVariant}
                      value={camera.tapoAuthVariant || 'cloud'}
                      class="form-control"
                    >
                      <option value="cloud">
                        <Text id="integration.frigate.device.tapoAuthCloud" />
                      </option>
                      <option value="sha256">
                        <Text id="integration.frigate.device.tapoAuthSha256" />
                      </option>
                    </select>
                    <div class="help-block">
                      <Text id="integration.frigate.device.tapoAuthHelp" />
                    </div>
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
                {camera.sourceType === SOURCE_TYPES.RTSP && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.subPathLabel" />
                    </label>
                    <Localizer>
                      <input
                        type="text"
                        value={camera.subPath}
                        onInput={this.updateSubPath}
                        class="form-control"
                        placeholder={<Text id="integration.frigate.device.subPathPlaceholder" />}
                      />
                    </Localizer>
                    <div class="help-block">
                      <Text id="integration.frigate.device.subPathHelp" />
                    </div>
                  </div>
                )}
                {camera.sourceType === SOURCE_TYPES.MJPEG && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.pathLabel" />
                    </label>
                    <input
                      type="text"
                      value={camera.path}
                      onInput={this.updatePath}
                      class="form-control"
                      placeholder="video.cgi"
                    />
                    <div class="help-block">
                      <Text id="integration.frigate.device.mjpegPathHelp" />
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
                {camera.sourceType === SOURCE_TYPES.CUSTOM && (
                  <div class="form-group">
                    <label>
                      <Text id="integration.frigate.device.customSubSourceLabel" />
                    </label>
                    <Localizer>
                      <input
                        type="text"
                        value={camera.customSubSource}
                        onInput={this.updateCustomSubSource}
                        class="form-control"
                        placeholder={<Text id="integration.frigate.device.customSourcePlaceholder" />}
                      />
                    </Localizer>
                    <div class="help-block">
                      <Text id="integration.frigate.device.customSubSourceHelp" />
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
export default withText({
  brandPlaceholderText: 'integration.frigate.device.catalog.brandPlaceholder',
  modelPlaceholderText: 'integration.frigate.device.catalog.modelPlaceholder',
  otherBrandText: 'integration.frigate.device.catalog.otherBrand',
  otherModelText: 'integration.frigate.device.catalog.otherModel'
})(FrigateCameraBox);
