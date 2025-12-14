import { connect } from 'unistore/preact';
import { Component } from 'preact';
import DeviceTab from './DeviceTab';
import MideaAcLanPage from '../MideaAcLanPage';
import createActions from '../actions';

class DevicePage extends Component {
    componentWillMount() {
        this.props.getDevices();
        this.props.getHouses();
    }

    render() {
        return (
            <MideaAcLanPage user={this.props.user}>
                <DeviceTab {...this.props} />
            </MideaAcLanPage>
        );
    }
}

export default connect('user,httpClient,housesWithRooms,devices', createActions)(DevicePage);


