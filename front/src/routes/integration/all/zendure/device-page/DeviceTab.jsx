import { Text, Localizer } from 'preact-i18n';
import cx from 'classnames';
import debounce from 'debounce';
import { Component } from 'preact';
import { connect } from 'unistore/preact';

import CardFilter from '../../../../../components/layout/CardFilter';
import { RequestStatus } from '../../../../../utils/consts';
import EmptyState from './EmptyState';
import style from './style.css';
import ZendureDeviceBox from '../ZendureDeviceBox';

class DeviceTab extends Component {
  constructor(props) {
    super(props);
    this.debouncedSearch = debounce(this.search, 200).bind(this);
  }

  componentWillMount() {
    this.getZendureDevices();
    this.getHouses();
  }

  getZendureDevices = async () => {
    this.setState({
      getZendureStatus: RequestStatus.Getting,
    });

    try {
      const options = {
        order_dir: this.state.orderDir || 'asc',
      };
      if (this.state.search && this.state.search.length) {
        options.search = this.state.search;
      }

      const zendureDevices = await this.props.httpClient.get('/api/v1/service/zendure/device', options);
      this.setState({
        zendureDevices,
        getZendureStatus: RequestStatus.Success,
      });
    } catch (e) {
      this.setState({
        getZendureStatus: RequestStatus.Error,
      });
    }
  };

  async getHouses() {
    this.setState({
      housesGetStatus: RequestStatus.Getting,
    });

    try {
      const housesWithRooms = await this.props.httpClient.get('/api/v1/house', {
        expand: 'rooms',
      });
      this.setState({
        housesWithRooms,
        housesGetStatus: RequestStatus.Success,
      });
    } catch (e) {
      this.setState({
        housesGetStatus: RequestStatus.Error,
      });
    }
  }

  async search(e) {
    await this.setState({
      search: e.target.value,
    });
    this.getZendureDevices();
  }

  changeOrderDir = async (e) => {
    await this.setState({
      orderDir: e.target.value,
    });
    this.getZendureDevices();
  };

  render({}, { orderDir, search, getZendureStatus, zendureDevices, housesWithRooms }) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.zendure.device.title" />
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
          <div
            class={cx('dimmer', {
              active: getZendureStatus === RequestStatus.Getting,
            })}
          >
            <div class="loader" />
            <div class={cx('dimmer-content', style.zendureListBody)}>
              <div class="row">
                {zendureDevices &&
                  zendureDevices.length > 0 &&
                  zendureDevices.map((device, index) => (
                    <ZendureDeviceBox
                      editable
                      saveButton
                      deleteButton
                      device={device}
                      deviceIndex={index}
                      getZendureDevices={this.getZendureDevices}
                      housesWithRooms={housesWithRooms}
                    />
                  ))}
                {!zendureDevices || (zendureDevices.length === 0 && <EmptyState />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient', {})(DeviceTab);
