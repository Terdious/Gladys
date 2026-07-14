import { Component } from 'preact';
import { connect } from 'unistore/preact';
import actions from './actions';
import FrigateDiscoverPage from './FrigateDiscover';

class FrigateDiscoverIntegration extends Component {
  async componentWillMount() {
    await this.props.getFrigateStatus();
    const { frigateStatus } = this.props;
    if (frigateStatus && frigateStatus.mode === 'remote') {
      this.props.discoverRemoteCameras();
    }
  }

  render(props, {}) {
    return <FrigateDiscoverPage {...props} />;
  }
}

export default connect(
  'user,session,httpClient,frigateStatus,remoteCameras,remoteCamerasStatus',
  actions
)(FrigateDiscoverIntegration);
