import { Text } from 'preact-i18n';
import { Link } from 'preact-router/match';

const EmptyState = () => (
  <div class="text-center w-100 p-4">
    <p>
      <Text id="integration.zendure.device.noDeviceFound" />
    </p>
    <small>
      <Text id="integration.zendure.discoverDeviceDescr" />
      <Link href="/dashboard/integration/device/zendure/discover">
        {' '}
        <Text id="integration.zendure.discoverTab" /> <i class="fe fe-radio" />
      </Link>
    </small>
  </div>
);

export default EmptyState;
