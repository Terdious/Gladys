import { connect } from 'unistore/preact';
import FrigatePage from '../FrigatePage';
import DebugTab from './DebugTab';

const FrigateDebugPage = props => (
  <FrigatePage user={props.user}>
    <DebugTab {...props} />
  </FrigatePage>
);

export default connect('user,session,httpClient', {})(FrigateDebugPage);
