import { connect } from 'unistore/preact';
import DiscoverTab from './DiscoverTab';
import ZendurePage from '../ZendurePage';

const ZendureDiscoverPage = (props) => (
  <ZendurePage user={props.user}>
    <DiscoverTab {...props} />
  </ZendurePage>
);

export default connect('user', {})(ZendureDiscoverPage);
