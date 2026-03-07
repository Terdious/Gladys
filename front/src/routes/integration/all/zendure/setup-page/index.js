import { connect } from 'unistore/preact';
import SetupTab from './SetupTab';
import ZendurePage from '../ZendurePage';

const ZendureSetupPage = (props) => (
  <ZendurePage user={props.user}>
    <SetupTab {...props} />
  </ZendurePage>
);

export default connect('user', {})(ZendureSetupPage);
