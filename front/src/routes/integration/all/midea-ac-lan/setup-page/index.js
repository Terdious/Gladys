import { connect } from 'unistore/preact';
import SetupTab from './SetupTab';
import MideaAcLanPage from '../MideaAcLanPage';

const SetupPage = props => (
    <MideaAcLanPage user={props.user}>
        <SetupTab {...props} />
    </MideaAcLanPage>
);

export default connect('user', {})(SetupPage);


