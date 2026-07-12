import { connect } from 'unistore/preact';
import FrigatePage from '../FrigatePage';
import SetupTab from './SetupTab';

const FrigateSetupPage = props => (
  <FrigatePage user={props.user}>
    <SetupTab {...props} />
  </FrigatePage>
);

export default connect('user,session,httpClient', {})(FrigateSetupPage);
