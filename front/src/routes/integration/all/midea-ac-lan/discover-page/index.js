import { connect } from 'unistore/preact';
import { Component } from 'preact';
import DiscoverTab from './DiscoverTab';
import MideaAcLanPage from '../MideaAcLanPage';
import createActions from '../actions';

class DiscoverPage extends Component {
    componentWillMount() {
        this.props.getDiscoveredDevices();
        this.props.getHouses();
    }

    render() {
        return (
            <MideaAcLanPage user={this.props.user}>
                <DiscoverTab {...this.props} />
            </MideaAcLanPage>
        );
    }
}

export default connect('user,httpClient,housesWithRooms,discoveredDevices', createActions)(DiscoverPage);


