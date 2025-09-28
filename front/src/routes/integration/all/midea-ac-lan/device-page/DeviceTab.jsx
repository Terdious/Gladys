import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';
import { RequestStatus } from '../../../../../utils/consts';
import CardFilter from '../../../../../components/layout/CardFilter';
import debounce from 'debounce';
import { Component } from 'preact';
import { connect } from 'unistore/preact';
import MideaAcLanDeviceBox from '../MideaAcLanDeviceBox';
import EmptyState from './EmptyState';

class DeviceTab extends Component {
  constructor(props) {
    super(props);
    this.debouncedSearch = debounce(this.search, 200).bind(this);
  }

  componentWillMount() {
    this.getDevices();
    this.getHouses();
  }

  getDevices = async () => {
    this.setState({ getDevicesStatus: RequestStatus.Getting });
    try {
      const options = { order_dir: (this.state && this.state.orderDir) || 'asc' };
      if (this.state && this.state.search && this.state.search.length) {
        options.search = this.state.search;
      }
      const devices = await this.props.httpClient.get('/api/v1/service/midea-ac-lan/devices', options);
      this.setState({ devices, getDevicesStatus: RequestStatus.Success });
    } catch (e) {
      this.setState({ getDevicesStatus: e.message });
    }
  };

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

  async search(e) {
    await this.setState({ search: e.target.value });
    this.getDevices();
  }

  changeOrderDir = async e => {
    await this.setState({ orderDir: e.target.value });
    this.getDevices();
  };

  render({}, { orderDir, search, getDevicesStatus, devices }) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.mideaAcLan.device.title" />
          </h1>
          <div class="page-options d-flex">
            <Localizer>
              <CardFilter
                changeOrderDir={this.changeOrderDir}
                orderValue={orderDir}
                search={this.debouncedSearch}
                searchValue={search}
                searchPlaceHolder={<Text id="device.searchPlaceHolder" />}
              />
            </Localizer>
          </div>
        </div>
        <div class="card-body">
          <div class={cx('dimmer', { active: getDevicesStatus === RequestStatus.Getting })}>
            <div class="loader" />
            <div class="dimmer-content">
              <div class="row">
                {devices && devices.length > 0 &&
                  devices.map((device, index) => (
                    <MideaAcLanDeviceBox
                      editable
                      saveButton
                      deleteButton
                      device={device}
                      deviceIndex={index}
                      getDevices={this.getDevices}
                      housesWithRooms={[]}
                    />
                  ))}
                {!devices || (devices.length === 0 && <EmptyState />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient', {})(DeviceTab);


