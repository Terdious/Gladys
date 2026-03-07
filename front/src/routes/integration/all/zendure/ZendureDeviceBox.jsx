import { Component } from 'preact';
import { Text, Localizer } from 'preact-i18n';
import get from 'get-value';
import DeviceFeatures from '../../../../components/device/view/DeviceFeatures';
import { connect } from 'unistore/preact';

class ZendureDeviceBox extends Component {
  componentWillMount() {
    this.setState({
      device: this.props.device,
    });
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      device: nextProps.device,
    });
  }

  updateName = (e) => {
    this.setState({
      device: {
        ...this.state.device,
        name: e.target.value,
      },
    });
  };

  updateRoom = (e) => {
    this.setState({
      device: {
        ...this.state.device,
        room_id: e.target.value,
      },
    });
  };

  buildDevicePayload = (device) => {
    const features = (device.features || []).map((feature) => ({
      id: feature.id,
      name: feature.name,
      external_id: feature.external_id,
      selector: feature.selector,
      category: feature.category,
      type: feature.type,
      read_only: feature.read_only,
      has_feedback: feature.has_feedback,
      min: feature.min,
      max: feature.max,
      unit: feature.unit,
      keep_history: feature.keep_history,
      energy_parent_id: feature.energy_parent_id,
    }));

    const params = (device.params || []).map((param) => ({
      id: param.id,
      name: param.name,
      value: param.value,
    }));

    return {
      id: device.id,
      external_id: device.external_id,
      selector: device.selector,
      name: device.name,
      model: device.model,
      service_id: device.service_id,
      room_id: device.room_id,
      should_poll: device.should_poll,
      poll_frequency: device.poll_frequency,
      features,
      params,
    };
  };

  saveDevice = async () => {
    this.setState({
      loading: true,
      errorMessage: null,
      errorDetails: null,
    });

    try {
      const payload = this.buildDevicePayload(this.state.device);
      const savedDevice = await this.props.httpClient.post('/api/v1/device', payload);
      const savedDeviceWithCloudContext = {
        ...savedDevice,
        cloud_device: this.state.device.cloud_device || savedDevice.cloud_device,
      };
      this.setState({
        device: savedDeviceWithCloudContext,
      });
      if (this.props.onDeviceSaved) {
        this.props.onDeviceSaved(this.props.deviceIndex, savedDeviceWithCloudContext);
      }
    } catch (e) {
      let errorMessage = 'integration.zendure.error.defaultError';
      if (get(e, 'response.status') === 409) {
        errorMessage = 'integration.zendure.error.conflictError';
      }
      this.setState({
        errorMessage,
        errorDetails: get(e, 'response.data.message') || get(e, 'response.data.code') || e.message,
      });
    }

    this.setState({
      loading: false,
    });
  };

  deleteDevice = async () => {
    this.setState({
      loading: true,
      errorMessage: null,
      errorDetails: null,
    });

    try {
      if (this.state.device.created_at) {
        await this.props.httpClient.delete(`/api/v1/device/${this.state.device.selector}`);
      }
      if (this.props.getZendureDevices) {
        this.props.getZendureDevices();
      }
    } catch (e) {
      this.setState({
        errorMessage: 'integration.zendure.error.defaultDeletionError',
        errorDetails: get(e, 'response.data.message') || get(e, 'response.data.code') || e.message,
      });
    }

    this.setState({
      loading: false,
    });
  };

  render(
    { deviceIndex, editable, deleteButton, saveButton, updateButton, alreadyCreatedButton, partiallySupportedButton, housesWithRooms },
    { device, loading, errorMessage, errorDetails },
  ) {
    const validModel = device.features && device.features.length > 0;
    const showPartiallySupportedButton = validModel && partiallySupportedButton;
    const cloudDevice = device.cloud_device || null;
    const localMqttEndpoint =
      cloudDevice && cloudDevice.server && cloudDevice.port ? `${cloudDevice.server}:${cloudDevice.port}` : null;

    return (
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <div>{device.name}</div>
          </div>
          <div class={loading ? 'dimmer active' : 'dimmer'}>
            <div class="loader" />
            <div class="dimmer-content">
              <div class="card-body">
                {errorMessage && (
                  <div class="alert alert-danger">
                    <Text id={errorMessage} />
                    {errorDetails && (
                      <div>
                        <small>{errorDetails}</small>
                      </div>
                    )}
                  </div>
                )}

                <div class="form-group">
                  <label class="form-label" for={`name_${deviceIndex}`}>
                    <Text id="integration.zendure.nameLabel" />
                  </label>
                  <Localizer>
                    <input
                      id={`name_${deviceIndex}`}
                      type="text"
                      value={device.name}
                      onInput={this.updateName}
                      class="form-control"
                      placeholder={<Text id="integration.zendure.namePlaceholder" />}
                      disabled={!editable || !validModel}
                    />
                  </Localizer>
                </div>

                <div class="form-group">
                  <label class="form-label" for={`model_${deviceIndex}`}>
                    <Text id="integration.zendure.modelLabel" />
                  </label>
                  <input id={`model_${deviceIndex}`} type="text" value={device.model} class="form-control" disabled="true" />
                </div>

                {cloudDevice && (
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.zendure.cloudDevice.title" />
                    </label>
                    <div>
                      <small class="text-muted">
                        <Text id="integration.zendure.cloudDevice.deviceKey" />: {cloudDevice.deviceKey || '-'}
                      </small>
                    </div>
                    <div>
                      <small class="text-muted">
                        <Text id="integration.zendure.cloudDevice.productKey" />: {cloudDevice.productKey || '-'}
                      </small>
                    </div>
                    <div>
                      <small class="text-muted">
                        <Text id="integration.zendure.cloudDevice.online" />:{' '}
                        {cloudDevice.online ? (
                          <Text id="integration.zendure.cloudDevice.onlineYes" />
                        ) : (
                          <Text id="integration.zendure.cloudDevice.onlineNo" />
                        )}
                      </small>
                    </div>
                    {cloudDevice.ip && (
                      <div>
                        <small class="text-muted">
                          <Text id="integration.zendure.cloudDevice.localIp" />: {cloudDevice.ip}
                        </small>
                      </div>
                    )}
                    {localMqttEndpoint && (
                      <div>
                        <small class="text-muted">
                          <Text id="integration.zendure.cloudDevice.localMqtt" />: {localMqttEndpoint}
                        </small>
                      </div>
                    )}
                  </div>
                )}

                <div class="form-group">
                  <label class="form-label" for={`room_${deviceIndex}`}>
                    <Text id="integration.zendure.roomLabel" />
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
                      housesWithRooms.map((house) => (
                        <optgroup label={house.name}>
                          {house.rooms.map((room) => (
                            <option selected={room.id === device.room_id} value={room.id}>
                              {room.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                </div>

                {validModel && (
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.zendure.device.featuresLabel" />
                    </label>
                    <DeviceFeatures features={device.features} />
                  </div>
                )}

                <div class="form-group d-flex flex-wrap align-items-start">
                  {showPartiallySupportedButton && (
                    <button class="btn btn-outline-warning mr-2 mb-2" disabled>
                      <Text id="integration.zendure.partiallyManagedModelButton" />
                    </button>
                  )}

                  {validModel && alreadyCreatedButton && (
                    <button class="btn btn-primary mr-2 mb-2" disabled>
                      <Text id="integration.zendure.alreadyCreatedButton" />
                    </button>
                  )}

                  {validModel && updateButton && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2 mb-2">
                      <Text id="integration.zendure.updateButton" />
                    </button>
                  )}

                  {validModel && saveButton && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2 mb-2">
                      <Text id="integration.zendure.saveButton" />
                    </button>
                  )}

                  {validModel && deleteButton && (
                    <button onClick={this.deleteDevice} class="btn btn-danger mb-2">
                      <Text id="integration.zendure.deleteButton" />
                    </button>
                  )}

                  {!validModel && (
                    <button class="btn btn-dark" disabled>
                      <Text id="integration.zendure.unmanagedModelButton" />
                    </button>
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

export default connect('httpClient', {})(ZendureDeviceBox);
