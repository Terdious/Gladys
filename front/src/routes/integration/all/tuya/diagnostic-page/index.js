import { connect } from 'unistore/preact';
import DiagnosticTab from './DiagnosticTab';
import TuyaPage from '../TuyaPage';

const DiagnosticPage = props => (
  <TuyaPage user={props.user} fullWidth>
    <DiagnosticTab {...props} />
  </TuyaPage>
);

export default connect('user,session,httpClient', {})(DiagnosticPage);
