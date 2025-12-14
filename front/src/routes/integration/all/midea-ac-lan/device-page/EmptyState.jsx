import { Text } from 'preact-i18n';
import { Link } from 'preact-router/match';

const EmptyState = () => (
  <div class="col-md-12">
    <div class="alert alert-secondary">
      <Text id="integration.mideaAcLan.device.noDevice" />
      <Link href="/dashboard/integration/device/midea-ac-lan/discover">
        <Text id="integration.mideaAcLan.device.discoverLink" />
      </Link>
    </div>
  </div>
);

export default EmptyState;


