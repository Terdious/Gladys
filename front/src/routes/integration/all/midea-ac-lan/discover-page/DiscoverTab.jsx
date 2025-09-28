import { Text } from 'preact-i18n';
import cx from 'classnames';
import { connect } from 'unistore/preact';
import { Component } from 'preact';
import { RequestStatus } from '../../../../../utils/consts';
import MideaAcLanDeviceBox from '../MideaAcLanDeviceBox';

class DiscoverTab extends Component {
  async componentWillMount() {
    this.getDiscoveredDevices();
    this.getHouses();
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
      const discoveredDevices = await this.props.httpClient.get('/api/v1/service/midea-ac-lan/discover', params);
      // eslint-disable-next-line no-console
      console.log('[Midea AC LAN] Discover response:', discoveredDevices);
      this.setState({ discoveredDevices, loading: false, errorLoading: false });
    } catch (e) {
      this.setState({ discoveredDevices: [], loading: false, errorLoading: true });
    }
  };

  render(props, { loading, errorLoading, discoveredDevices, housesWithRooms }) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.mideaAcLan.discover.title" />
          </h1>
          <div class="page-options d-flex">
            <input type="text" placeholder="auto / 192.168.1.255 / 10.0.0.5" class="form-control mr-2" value={(this.state && this.state.target) || ''} onInput={(e) => this.setState({ target: e.target.value })} />
            <button onClick={this.getDiscoveredDevices} class="btn btn-outline-primary" disabled={loading}>
              <Text id="integration.mideaAcLan.discover.scan" /> <i class="fe fe-radio" />
            </button>
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
                      <Text id="integration.mideaAcLan.discover.empty" />
                    </div>
                  </div>
                )}
                {discoveredDevices &&
                  discoveredDevices.length > 0 &&
                  discoveredDevices.map((device, index) => (
                    <MideaAcLanDeviceBox
                      editable={!device.created_at || device.updatable}
                      alreadyCreatedButton={device.created_at && !device.updatable}
                      updateButton={device.updatable}
                      saveButton={!device.created_at}
                      device={device}
                      deviceIndex={index}
                      housesWithRooms={housesWithRooms}
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

export default connect('httpClient', {})(DiscoverTab);


