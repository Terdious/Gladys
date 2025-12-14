import { Text } from 'preact-i18n';
import cx from 'classnames';
import { Component } from 'preact';
import { RequestStatus } from '../../../../../utils/consts';
import MideaAcLanDeviceBox from '../MideaAcLanDeviceBox';

class DiscoverTab extends Component {
  async componentWillMount() {
    // Utiliser l'action globale au lieu de la méthode locale
    if (this.props.getDiscoveredDevices) {
      await this.props.getDiscoveredDevices();
    }
    if (this.props.getHouses) {
      await this.props.getHouses();
    }
  }

  async getHouses() {
    this.setState({ housesGetStatus: RequestStatus.Getting });
    try {
      const params = { expand: 'rooms' };
      const housesWithRooms = await this.props.httpClient.get(`/api/v1/house`, params);
      this.setState({ housesWithRooms, housesGetStatus: RequestStatus.Success });
    } catch (e) {
      this.setState({ housesGetStatus: RequestStatus.Error });
    }
  }

  getDiscoveredDevices = async () => {
    this.setState({ loading: true });
    try {
      const params = {};
      if (this.state && this.state.target && this.state.target.trim()) params.target = this.state.target.trim();
      
      // Utiliser l'action globale qui met à jour le state global
      const response = await this.props.getDiscoveredDevices(params);
      // eslint-disable-next-line no-console
      console.log('[Midea AC LAN] Discover response:', response);
      
      // Handle new response format with metadata
      const metadata = response.metadata || {};
      
      this.setState({ 
        metadata,
        loading: false, 
        errorLoading: false 
      });
    } catch (e) {
      this.setState({ metadata: {}, loading: false, errorLoading: true });
    }
  };

  render(props, { loading, errorLoading, metadata }) {
    // Utiliser les props du state global au lieu du state local
    const { discoveredDevices, housesWithRooms } = props;
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.mideaAcLan.discover.title" />
          </h1>
          <div class="page-options d-flex align-items-center">
            <input 
              type="text" 
              placeholder="192.168.1.255 / 10.0.0.5" 
              class="form-control mr-2" 
              value={(this.state && this.state.target) || ''} 
              onInput={(e) => this.setState({ target: e.target.value })} 
            />
            <div style="width: 120px;">
              <button
                class={cx('btn w-100', {
                  'btn-outline-danger': loading,
                  'btn-outline-primary': !loading
                })}
                onClick={this.getDiscoveredDevices}
                disabled={loading}
              >
                <span class="d-none d-md-inline mr-2">
                  <Text id="integration.mideaAcLan.discover.scan" />
                </span>
                <i class="fe fe-radio" />
              </button>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div class={cx('dimmer', { active: loading })}>
            <div class="loader" />
            <div class={cx('dimmer-content')}>
              <div class="row">
                {discoveredDevices && discoveredDevices.length === 0 && (
                  <div class="col-md-12">
                    <div class="alert alert-secondary">
                      {metadata && metadata.filteredOut > 0 ? (
                        <Text id="integration.mideaAcLan.discover.noNewDevices" />
                      ) : (
                        <Text id="integration.mideaAcLan.discover.empty" />
                      )}
                    </div>
                  </div>
                )}
                {discoveredDevices &&
                  discoveredDevices.length > 0 &&
                  discoveredDevices.map((device, index) => (
                    <MideaAcLanDeviceBox
                      {...this.props}
                      editable={!device.created_at || device.updatable}
                      alreadyCreatedButton={device.created_at && !device.updatable}
                      updateButton={device.updatable}
                      saveButton={!device.created_at}
                      device={device}
                      deviceIndex={index}
                      listName="discoveredDevices"
                      housesWithRooms={housesWithRooms}
                      afterSave={this.getDiscoveredDevices}
                    />
                  ))}
                {errorLoading && (
                  <div class="col-md-12">
                    <div class="alert alert-warning">
                      <Text id="integration.mideaAcLan.status.notConnected" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default DiscoverTab;


