import { Text } from 'preact-i18n';
import { Link } from 'preact-router/match';
import cx from 'classnames';
import { Component } from 'preact';
import { connect } from 'unistore/preact';
import get from 'get-value';

import { RequestStatus } from '../../../../../utils/consts';
import EmptyState from './EmptyState';
import style from './style.css';
import ZendureDeviceBox from '../ZendureDeviceBox';

const getDeviceSortRank = (device) => {
  const features = device.features || [];
  const validModel = features.length > 0;
  if (!validModel) return 3;
  if (!device.created_at) return 0;
  if (device.updatable) return 1;
  return 2;
};

const sortDiscoveredDevices = (devices) => {
  return [...devices].sort((a, b) => {
    const rankDiff = getDeviceSortRank(a) - getDeviceSortRank(b);
    if (rankDiff !== 0) return rankDiff;

    const nameDiff = (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
    if (nameDiff !== 0) return nameDiff;

    return (a.external_id || '').toLowerCase().localeCompare((b.external_id || '').toLowerCase());
  });
};

class DiscoverTab extends Component {
  componentWillMount() {
    this.getDiscoveredDevices();
    this.getHouses();
  }

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

  getDiscoveredDevices = async () => {
    this.setState({
      loading: true,
      errorLoadingMessage: null,
    });

    try {
      const discoveredDevices = await this.props.httpClient.get('/api/v1/service/zendure/discover');
      this.setState({
        discoveredDevices: sortDiscoveredDevices(discoveredDevices),
        loading: false,
        errorLoading: false,
      });
    } catch (e) {
      this.setState({
        loading: false,
        errorLoading: true,
        errorLoadingMessage: get(e, 'response.data.message') || get(e, 'response.data.code') || e.message,
      });
    }
  };

  onDeviceSaved = (deviceIndex, savedDevice) => {
    const discoveredDevices = [...(this.state.discoveredDevices || [])];
    discoveredDevices.splice(deviceIndex, 1, savedDevice);
    this.setState({
      discoveredDevices: sortDiscoveredDevices(discoveredDevices),
    });
  };

  render(props, { loading, errorLoading, errorLoadingMessage, discoveredDevices, housesWithRooms }) {
    return (
      <div class="card">
        <div class="card-header">
          <h1 class="card-title">
            <Text id="integration.zendure.discover.title" />
          </h1>
          <div class="page-options d-flex">
            <button onClick={this.getDiscoveredDevices} class="btn btn-outline-primary ml-2" disabled={loading}>
              <Text id="integration.zendure.discover.scan" /> <i class="fe fe-radio" />
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="alert alert-secondary">
            <Text id="integration.zendure.discover.description" />
          </div>
          <div
            class={cx('dimmer', {
              active: loading,
            })}
          >
            <div class="loader" />
            <div class={cx('dimmer-content', style.zendureListBody)}>
              {errorLoading && (
                <p class="alert alert-warning">
                  <Text id="integration.zendure.status.notConnected" />
                  <Link href="/dashboard/integration/device/zendure/setup">
                    <Text id="integration.zendure.status.setupPageLink" />
                  </Link>
                  {errorLoadingMessage && (
                    <span class="d-block mt-2">
                      <small>{errorLoadingMessage}</small>
                    </span>
                  )}
                </p>
              )}
              <div class="row">
                {discoveredDevices &&
                  discoveredDevices.map((device, index) => (
                    <ZendureDeviceBox
                      editable={!device.created_at || device.updatable}
                      alreadyCreatedButton={device.created_at && !device.updatable}
                      updateButton={device.updatable}
                      saveButton={!device.created_at}
                      partiallySupportedButton={device.partially_supported}
                      device={device}
                      deviceIndex={index}
                      housesWithRooms={housesWithRooms}
                      onDeviceSaved={this.onDeviceSaved}
                    />
                  ))}
                {!discoveredDevices || (discoveredDevices.length === 0 && <EmptyState />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect('httpClient', {})(DiscoverTab);
