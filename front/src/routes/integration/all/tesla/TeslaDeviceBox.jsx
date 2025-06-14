import { Component } from 'preact';
import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';
import { connect } from 'unistore/preact';
import dayjs from 'dayjs';
import get from 'get-value';
import DeviceFeatures from '../../../../components/device/view/DeviceFeatures';
import BatteryLevelFeature from '../../../../components/device/view/BatteryLevelFeature';
import { DEVICE_FEATURE_CATEGORIES } from '../../../../../../server/utils/constants';
import styles from './style.css';

class TeslaDeviceBox extends Component {
  componentWillMount() {
    this.setState({
      device: this.props.device,
      user: this.props.user
    });
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      device: nextProps.device
    });
  }

  updateName = e => {
    this.setState({
      device: {
        ...this.state.device,
        name: e.target.value
      }
    });
  };

  updateRoom = e => {
    this.setState({
      device: {
        ...this.state.device,
        room_id: e.target.value
      }
    });
  };

  saveDevice = async () => {
    this.setState({
      loading: true,
      errorMessage: null
    });
    try {
      const savedDevice = await this.props.httpClient.post(`/api/v1/device`, this.state.device);
      this.setState({
        device: savedDevice,
        isSaving: true
      });
    } catch (e) {
      let errorMessage = 'integration.tesla.error.defaultError';
      if (e.response.status === 409) {
        errorMessage = 'integration.tesla.error.conflictError';
      }
      this.setState({
        errorMessage
      });
    }
    this.setState({
      loading: false
    });
  };

  deleteDevice = async () => {
    this.setState({
      loading: true,
      errorMessage: null
    });
    try {
      if (this.state.device.created_at) {
        await this.props.httpClient.delete(`/api/v1/device/${this.state.device.selector}`);
      }
      this.props.getTeslaDevices();
    } catch (e) {
      this.setState({
        errorMessage: 'integration.tesla.error.defaultDeletionError'
      });
    }
    this.setState({
      loading: false
    });
  };

  getDeviceProperty = () => {
    const device = this.state.device;
    if (!device.features) {
      return null;
    }

    const batteryLevelDeviceFeature = device.features.find(
      deviceFeature => deviceFeature.category === DEVICE_FEATURE_CATEGORIES.BATTERY
    );
    const batteryLevel = get(batteryLevelDeviceFeature, 'last_value');

    let mostRecentValueAt = null;
    device.features.forEach(feature => {
      if (feature.last_value_changed && new Date(feature.last_value_changed) > mostRecentValueAt) {
        mostRecentValueAt = new Date(feature.last_value_changed);
      }
    });

    const isDeviceReachable = (device, now = new Date()) => {
      const isRecent = (date, time) => (now - new Date(date)) / (1000 * 60) <= time;
      const hasRecentFeature = device.features.some(feature => isRecent(feature.last_value_changed, 15));
      return hasRecentFeature;
    };
    const online = isDeviceReachable(device);

    return {
      batteryLevel,
      mostRecentValueAt,
      online
    };
  };

  render(
    {
      deviceIndex,
      editable,
      deleteButton,
      saveButton,
      updateButton,
      alreadyCreatedButton,
      showMostRecentValueAt,
      housesWithRooms
    },
    { device, user, loading, errorMessage }
  ) {
    const validModel = (device.features && device.features.length > 0) || !device.not_handled;
    const { batteryLevel, mostRecentValueAt, online } = this.getDeviceProperty();
    const vehicleId = device.external_id.replace('tesla:', '');
    const saveButtonCondition =
      (saveButton && !alreadyCreatedButton) || (saveButton && !this.state.isSaving && alreadyCreatedButton);
    const modelImage = `/assets/integrations/devices/tesla/tesla-${device.model}.jpg`;

    return (
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <Localizer>
              <div title={<Text id={`integration.tesla.status.${online ? 'online' : 'offline'}`} />}>
                <i class={`fe fe-radio text-${online ? 'success' : 'danger'}`} />
                &nbsp;{device.name}
              </div>
            </Localizer>
            {showMostRecentValueAt && batteryLevel && (
              <div class="page-options d-flex">
                <BatteryLevelFeature batteryLevel={batteryLevel} />
              </div>
            )}
          </div>
          <div
            class={cx('dimmer', {
              active: loading
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              <div class="card-body">
                {errorMessage && (
                  <div class="alert alert-danger">
                    <Text id={errorMessage} />
                  </div>
                )}
                <div class="form-group">
                  <img
                    src={modelImage}
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src = '/assets/integrations/cover/tesla.jpg';
                    }}
                    alt={`Image de ${device.name}`}
                    className={styles['device-image-container']}
                  />
                </div>
                <div class="form-group">
                  <label class="form-label" for={`name_${deviceIndex}`}>
                    <Text id="integration.tesla.device.nameLabel" />
                  </label>
                  <Localizer>
                    <input
                      id={`name_${deviceIndex}`}
                      type="text"
                      value={device.name}
                      onInput={this.updateName}
                      class="form-control"
                      placeholder={<Text id="integration.tesla.device.namePlaceholder" />}
                      disabled={!editable || !validModel}
                    />
                  </Localizer>
                </div>

                <div class="form-group">
                  <label class="form-label" for={`model_${deviceIndex}`}>
                    <Text id="integration.tesla.device.modelLabel" />
                  </label>
                  <input
                    id={`model_${deviceIndex}`}
                    type="text"
                    value={device.model}
                    class="form-control"
                    disabled="true"
                  />
                </div>

                {vehicleId && (
                  <div class="form-group">
                    <label class="form-label" for={`vehicleId_${deviceIndex}`}>
                      <Text id="integration.tesla.device.vehicleIdLabel" />
                    </label>
                    <input
                      id={`vehicleId_${deviceIndex}`}
                      type="text"
                      value={vehicleId}
                      class="form-control"
                      disabled="true"
                    />
                  </div>
                )}

                {validModel && (
                  <div class="form-group">
                    <label class="form-label" for={`room_${deviceIndex}`}>
                      <Text id="integration.tesla.device.roomLabel" />
                    </label>
                    <select
                      id={`room_${deviceIndex}`}
                      onChange={this.updateRoom}
                      class="form-control"
                      disabled={!editable || !validModel}
                    >
                      <option value="">
                        <Text id="global.emptySelectOption" />
                      </option>
                      {housesWithRooms &&
                        housesWithRooms.map(house => (
                          <optgroup label={house.name}>
                            {house.rooms.map(room => (
                              <option selected={room.id === device.room_id} value={room.id}>
                                {room.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                    </select>
                  </div>
                )}

                {validModel && (
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.tesla.device.featuresLabel" />
                    </label>
                    <DeviceFeatures features={device.features} />
                  </div>
                )}

                <div class="form-group">
                  {validModel && this.state.isSaving && alreadyCreatedButton && (
                    <button class="btn btn-primary mr-2" disabled="true">
                      <Text id="integration.tesla.discover.alreadyCreatedButton" />
                    </button>
                  )}

                  {validModel && updateButton && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2">
                      <Text id="integration.tesla.discover.updateButton" />
                    </button>
                  )}

                  {validModel && saveButtonCondition && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2">
                      <Text id="integration.tesla.device.saveButton" />
                    </button>
                  )}

                  {validModel && deleteButton && (
                    <button onClick={this.deleteDevice} class="btn btn-danger">
                      <Text id="integration.tesla.device.deleteButton" />
                    </button>
                  )}

                  {validModel && showMostRecentValueAt && (
                    <p class="mt-4">
                      {mostRecentValueAt ? (
                        <Text
                          id="integration.tesla.device.mostRecentValueAt"
                          fields={{
                            mostRecentValueAt: dayjs(mostRecentValueAt)
                              .locale(user.language)
                              .fromNow()
                          }}
                        />
                      ) : (
                        <Text id="integration.tesla.device.noValueReceived" />
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient,user', {})(TeslaDeviceBox);
