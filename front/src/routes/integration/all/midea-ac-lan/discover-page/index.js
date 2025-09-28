import { connect } from 'unistore/preact';
import DiscoverTab from './DiscoverTab';
import MideaAcLanPage from '../MideaAcLanPage';

const DiscoverPage = props => (
    <MideaAcLanPage user={props.user}>
        <DiscoverTab {...props} />
    </MideaAcLanPage>
);

export default connect('user', {})(DiscoverPage);


