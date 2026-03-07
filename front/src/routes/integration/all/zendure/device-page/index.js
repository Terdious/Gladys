import { connect } from 'unistore/preact';
import DeviceTab from './DeviceTab';
import ZendurePage from '../ZendurePage';

const DevicePage = (props) => (
  <ZendurePage user={props.user}>
    <DeviceTab {...props} />
  </ZendurePage>
);

export default connect('user', {})(DevicePage);
