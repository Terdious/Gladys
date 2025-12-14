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
      const { id, udpId, host, rawUdpResponse } = this.state.device || {};
      const res = await this.props.httpClient.post('/api/v1/service/midea-ac-lan/confirm', { id, udpId, host, rawUdpResponse });
      const next = { ...this.state.device };
      if (res && res.token) next.token = res.token;
      if (res && res.key) next.key = res.key;
      if (res && res.model) next.model = res.model;
      if (res && res.capabilities) next.capabilities = res.capabilities;
      if (res && res.protocol) next.protocol = res.protocol;
      this.setState({ device: next, confirmOk: !!(res && res.token && res.key) });
      
      // Mettre à jour le state global si on est dans discoveredDevices
      if (this.props.listName === 'discoveredDevices' && this.props.getDiscoveredDevices) {
        await this.props.getDiscoveredDevices();
      }
    } catch (e) {
      this.setState({ errorMessage: 'integration.mideaAcLan.error.defaultError' });
    }
    this.setState({ loading: false });
  };

  saveDevice = async () => {
    this.setState({ loading: true, errorMessage: null });
    try {
      console.log('[Midea AC LAN] saveDevice called');
      console.log('[Midea AC LAN] props:', Object.keys(this.props));
      console.log('[Midea AC LAN] saveDevice function exists:', typeof this.props.saveDevice);
      console.log('[Midea AC LAN] listName:', this.props.listName, 'deviceIndex:', this.props.deviceIndex);
      console.log('[Midea AC LAN] saveDevice device:', this.state.device);
      console.log('[Midea AC LAN] saveDevice state:', this.props.state);
      console.log('[Midea AC LAN] saveDevice listName:', this.props.listName);
      console.log('[Midea AC LAN] saveDevice deviceIndex:', this.props.deviceIndex);
      await this.props.saveDevice(this.props.listName, this.props.deviceIndex);
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
    console.log('[Midea AC LAN] deleteDevice called');
    console.log('[Midea AC LAN] props:', Object.keys(this.props));
    console.log('[Midea AC LAN] deleteDevice function exists:', typeof this.props.deleteDevice);
    console.log('[Midea AC LAN] listName:', this.props.listName, 'deviceIndex:', this.props.deviceIndex);
    this.setState({ loading: true, errorMessage: null, tooMuchStatesError: false, statesNumber: undefined });
    try {
      if (!this.props.deleteDevice) {
        throw new Error('deleteDevice function not found in props');
      }
      await this.props.deleteDevice(this.props.listName, this.props.deviceIndex);
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
                          {house.rooms && house.rooms.map(room => (
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

                {/* Device parameters - different sources for discovery vs devices tab */}
                <div class="form-group">
                  <label class="form-label">Id de l'appareil</label>
                  <input type="text" class="form-control" value={deleteButton ? (device.params && device.params.MIDEA_UDPID || '') : (device.udpId || '')} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Code appareil</label>
                  <input type="text" class="form-control" value={deleteButton ? (device.params && device.params.MIDEA_ID || '') : (device.id || '')} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Type</label>
                  <input type="text" class="form-control" value={deleteButton ? (device.params && device.params.MIDEA_TYPE || '') : (device.type || '')} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Host</label>
                  <input type="text" class="form-control" value={deleteButton ? (device.params && device.params.MIDEA_HOST || '') : (device.host || '')} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Port</label>
                  <input type="number" class="form-control" value={deleteButton ? (device.params && device.params.MIDEA_PORT || 6444) : (device.port || 6444)} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Protocole</label>
                  <input type="number" class="form-control" value={device.protocol || 3} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Sous type</label>
                  <input type="text" class="form-control" value={deleteButton ? (device.params && device.params.MIDEA_SUBTYPE !== undefined ? String(device.params.MIDEA_SUBTYPE) : '') : (device.subtype !== undefined ? String(device.subtype) : '')} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Firmware</label>
                  <input type="text" class="form-control" value={deleteButton ? (device.params && device.params.MIDEA_FW || '') : (device.fw || '')} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Token</label>
                  <input type="text" class="form-control" value={deleteButton ? (device.params && device.params.MIDEA_TOKEN || '') : (device.token || '')} disabled />
                </div>
                <div class="form-group">
                  <label class="form-label">Key</label>
                  <input 
                    type="text" 
                    class="form-control" 
                    value={deleteButton ? (device.params && device.params.MIDEA_KEY || '') : (device.key || '')} 
                    disabled
                  />
                </div>
                {!deleteButton && (
                  <div class="form-group">
                    <button class="btn btn-outline-primary" onClick={this.confirmFromCloud} disabled={loading}>
                      Récupérer Token/Key
                    </button>
                    {this.state.confirmOk && (
                      <span class="text-success ml-2">OK</span>
                    )}
                  </div>
                )}

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
                  {validModel && alreadyCreatedButton && (
                    <button class="btn btn-primary mr-2" disabled="true">
                      <Text id="integration.mideaAcLan.alreadyCreatedButton" />
                    </button>
                  )}
                  {validModel && deleteButton && (
                    <button onClick={this.deleteDevice} class="btn btn-danger">
                      <Text id="integration.mideaAcLan.deleteButton" />
                    </button>
                  )}
                  {(!device.features || device.features.length === 0) && !device.type ? (
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


