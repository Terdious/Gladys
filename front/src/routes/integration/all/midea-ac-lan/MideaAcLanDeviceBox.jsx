import { Component } from 'preact';
import { Text, Localizer, MarkupText } from 'preact-i18n';
import cx from 'classnames';
import get from 'get-value';
import DeviceFeatures from '../../../../components/device/view/DeviceFeatures';
import { connect } from 'unistore/preact';

class MideaAcLanDeviceBox extends Component {
  componentWillMount() {
    this.setState({ device: this.props.device });
  }

  componentWillReceiveProps(nextProps) {
    this.setState({ device: nextProps.device });
  }

  updateName = e => {
    this.setState({ device: { ...this.state.device, name: e.target.value } });
  };

  updateRoom = e => {
    this.setState({ device: { ...this.state.device, room_id: e.target.value } });
  };

  updateField = name => e => {
    this.setState({ device: { ...this.state.device, [name]: e.target.value } });
  };

  confirmFromCloud = async () => {
    this.setState({ loading: true, errorMessage: null, confirmOk: false });
    try {
      const { id, udpId } = this.state.device || {};
      const res = await this.props.httpClient.post('/api/v1/service/midea-ac-lan/confirm', { id, udpId });
      const next = { ...this.state.device };
      if (res && res.token) next.token = res.token;
      if (res && res.key) next.key = res.key;
      this.setState({ device: next, confirmOk: !!(res && res.token && res.key) });
    } catch (e) {
      this.setState({ errorMessage: 'integration.mideaAcLan.error.defaultError' });
    }
    this.setState({ loading: false });
  };

  saveDevice = async () => {
    this.setState({ loading: true, errorMessage: null });
    try {
      let savedDevice;
      // When adding from discovery, send to service route which returns { device, ... }
      if (this.state.device && (this.state.device.key || this.state.device.token || this.state.device.host)) {
        const created = await this.props.httpClient.post('/api/v1/service/midea-ac-lan/device', this.state.device);
        savedDevice = created.device || created;
      } else {
        savedDevice = await this.props.httpClient.post(`/api/v1/device`, this.state.device);
      }
      this.setState({ device: savedDevice });
      if (this.props.afterSave) this.props.afterSave(savedDevice);
    } catch (e) {
      let errorMessage = 'integration.mideaAcLan.error.defaultError';
      if (get(e, 'response.status') === 409) {
        errorMessage = 'integration.mideaAcLan.error.conflictError';
      }
      this.setState({ errorMessage });
    }
    this.setState({ loading: false });
  };

  deleteDevice = async () => {
    this.setState({ loading: true, errorMessage: null, tooMuchStatesError: false, statesNumber: undefined });
    try {
      if (this.state.device.created_at) {
        await this.props.httpClient.delete(`/api/v1/device/${this.state.device.selector}`);
      }
      if (this.props.getDevices) this.props.getDevices();
    } catch (e) {
      const status = get(e, 'response.status');
      const dataMessage = get(e, 'response.data.message');
      if (status === 400 && dataMessage && dataMessage.includes('Too much states')) {
        const statesNumber = new Intl.NumberFormat().format(dataMessage.split(' ')[0]);
        this.setState({ tooMuchStatesError: true, statesNumber });
      } else {
        this.setState({ errorMessage: 'integration.mideaAcLan.error.defaultDeletionError' });
      }
    }
    this.setState({ loading: false });
  };

  render(
    { deviceIndex, editable, editButton, deleteButton, saveButton, updateButton, alreadyCreatedButton, housesWithRooms },
    { device, loading, errorMessage, tooMuchStatesError, statesNumber }
  ) {
    const validModel = true;
    const online = device.online;
    return (
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <Localizer>
              <div title={<Text id={`integration.mideaAcLan.status.${online ? 'online' : 'offline'}`} />}>
                <i class={`fe fe-radio text-${online ? 'success' : 'danger'}`} />
                &nbsp;{device.name}
              </div>
            </Localizer>
          </div>
          <div class={cx('dimmer', { active: loading })}>
            <div class="loader" />
            <div class="dimmer-content">
              <div class="card-body">
                {errorMessage && (
                  <div class="alert alert-danger">
                    <Text id={errorMessage} />
                  </div>
                )}
                {tooMuchStatesError && (
                  <div class="alert alert-warning">
                    <MarkupText id="device.tooMuchStatesToDelete" fields={{ count: statesNumber }} />
                  </div>
                )}

                <div class="form-group">
                  <label class="form-label" for={`name_${deviceIndex}`}>
                    <Text id="integration.mideaAcLan.nameLabel" />
                  </label>
                  <Localizer>
                    <input
                      id={`name_${deviceIndex}`}
                      type="text"
                      value={device.name}
                      onInput={this.updateName}
                      class="form-control"
                      placeholder={<Text id="integration.mideaAcLan.namePlaceholder" />}
                      disabled={!editable || !validModel}
                    />
                  </Localizer>
                </div>

                <div class="form-group">
                  <label class="form-label" for={`model_${deviceIndex}`}>
                    <Text id="integration.mideaAcLan.modelLabel" />
                  </label>
                  <input id={`model_${deviceIndex}`} type="text" value={device.model || ''} class="form-control" disabled="true" />
                </div>

                <div class="form-group">
                  <label class="form-label" for={`room_${deviceIndex}`}>
                    <Text id="integration.mideaAcLan.roomLabel" />
                  </label>
                  <select id={`room_${deviceIndex}`} onChange={this.updateRoom} class="form-control" disabled={!editable || !validModel}>
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

                {true && (
                  <div class="form-group">
                    <label class="form-label">
                      <Text id="integration.mideaAcLan.device.featuresLabel" />
                    </label>
                    <DeviceFeatures features={device.features} />
                  </div>
                )}

                {/* Discovery details & credentials */}
                <div class="form-group">
                  <label class="form-label">Code appareil</label>
                  <input type="text" class="form-control" value={device.id || ''} onInput={this.updateField('id')} />
                </div>
                <div class="form-group">
                  <label class="form-label">Type</label>
                  <input type="text" class="form-control" value={device.type || ''} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Host</label>
                  <input type="text" class="form-control" value={device.host || ''} onInput={this.updateField('host')} />
                </div>
                <div class="form-group">
                  <label class="form-label">Port</label>
                  <input type="number" class="form-control" value={device.port || 6444} onInput={this.updateField('port')} />
                </div>
                <div class="form-group">
                  <label class="form-label">Protocole</label>
                  <input type="number" class="form-control" value={device.protocol || 3} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Sous type</label>
                  <input type="text" class="form-control" value={device.subtype || ''} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Firmware</label>
                  <input type="text" class="form-control" value={device.fw || ''} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Token</label>
                  <input type="text" class="form-control" value={device.token || ''} onInput={this.updateField('token')} />
                </div>
                <div class="form-group">
                  <label class="form-label">Key</label>
                  <input type="text" class="form-control" value={device.key || ''} onInput={this.updateField('key')} />
                </div>
                <div class="form-group">
                  <button class="btn btn-outline-primary" onClick={this.confirmFromCloud} disabled={loading}>
                    Récupérer Token/Key depuis le cloud
                  </button>
                  {this.state.confirmOk && (
                    <span class="text-success ml-2">OK</span>
                  )}
                </div>

                <div class="form-group">
                  {validModel && alreadyCreatedButton && (
                    <button class="btn btn-primary mr-2" disabled="true">
                      <Text id="integration.mideaAcLan.alreadyCreatedButton" />
                    </button>
                  )}
                  {validModel && updateButton && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2">
                      <Text id="integration.mideaAcLan.updateButton" />
                    </button>
                  )}
                  {validModel && saveButton && (
                    <button onClick={this.saveDevice} class="btn btn-success mr-2">
                      <Text id="integration.mideaAcLan.saveButton" />
                    </button>
                  )}
                  {validModel && deleteButton && (
                    <button onClick={this.deleteDevice} class="btn btn-danger">
                      <Text id="integration.mideaAcLan.deleteButton" />
                    </button>
                  )}
                  {!device.features || device.features.length === 0 ? (
                    <span class="text-muted"><Text id="integration.mideaAcLan.unmanagedModelButton" /></span>
                  ) : null}
                  {validModel && editButton && (
                    <button class="btn btn-secondary float-right" disabled>
                      <Text id="integration.mideaAcLan.device.editButton" />
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

export default connect('httpClient', {})(MideaAcLanDeviceBox);


