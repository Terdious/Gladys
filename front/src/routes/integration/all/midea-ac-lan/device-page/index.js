import { connect } from 'unistore/preact';
import DeviceTab from './DeviceTab';
import MideaAcLanPage from '../MideaAcLanPage';

const DevicePage = props => (
    <MideaAcLanPage user={props.user}>
        <DeviceTab {...props} />
    </MideaAcLanPage>
);

export default connect('user', {})(DevicePage);


