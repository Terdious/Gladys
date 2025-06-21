import { Text } from 'preact-i18n';
import { Link } from 'preact-router/match';
import { STATUS } from '../../../../../../../server/services/tesla/lib/utils/tesla.constants';

const StateConnection = props => (
  <div>
    {!props.accessDenied &&
      ((props.connectTeslaStatus === STATUS.DISCOVERING_DEVICES && (
        <p class="text-center alert alert-info">
          <Text id="integration.tesla.status.dicoveringDevices" />
        </p>
      )) ||
        (props.connectTeslaStatus === STATUS.GET_DEVICES_VALUES && (
          <p class="text-center alert alert-info">
            <Text id="integration.tesla.status.getDevicesValues" />
          </p>
        )) ||
        (props.connectTeslaStatus === STATUS.CONNECTING && (
          <p class="text-center alert alert-info">
            <Text id="integration.tesla.status.connecting" />
          </p>
        )) ||
        (props.connectTeslaStatus === STATUS.PROCESSING_TOKEN && (
          <p class="text-center alert alert-warning">
            <Text id="integration.tesla.status.processingToken" />
          </p>
        )) ||
        (props.connected && (
          <p class="text-center alert alert-success">
            <Text id="integration.tesla.status.connect" />
          </p>
        )) ||
        (props.connectTeslaStatus === STATUS.DISCONNECTED && (
          <p class="text-center alert alert-danger">
            <Text id="integration.tesla.status.disconnect" />
          </p>
        )) ||
        ((props.errorLoading || props.connectTeslaStatus === STATUS.NOT_INITIALIZED) && (
          <p class="text-center alert alert-warning">
            <Text id="integration.tesla.status.notConnected" />
            <Link href="/dashboard/integration/device/tesla/setup">
              <Text id="integration.tesla.status.setupPageLink" />
            </Link>
          </p>
        )))}
  </div>
);

export default StateConnection;
