import { Component } from 'preact';
import { connect } from 'unistore/preact';
import actions from './actions';
import FrigateDevicesPage from './FrigateDevices';

class FrigateDeviceIntegration extends Component {
  componentWillMount() {
    this.props.getFrigateDevices();
    this.props.getHouses();
    this.props.getIntegrationByName('frigate');
  }

  render(props, {}) {
    return <FrigateDevicesPage {...props} />;
  }
}

export default connect(
  'user,session,httpClient,frigateCameras,housesWithRooms,getFrigateCamerasStatus,frigateCameraSearch,getFrigateCamerasOrderDir',
  actions
)(FrigateDeviceIntegration);
