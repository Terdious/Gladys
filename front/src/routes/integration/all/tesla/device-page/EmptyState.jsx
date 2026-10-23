import { Text } from 'preact-i18n';
import { Link } from 'preact-router/match';
import cx from 'classnames';
import style from './style.css';

const EmptyState = () => (
  <div class="col-md-12">
    <div class={cx('text-center', style.emptyStateDivBox)}>
      <Text id="integration.tesla.device.noDeviceFound" />

      <div class="mt-5">
        <Text id="integration.tesla.discoverDeviceDescr" />
        <Link href="/dashboard/integration/device/tesla/discover">
          <button class="btn btn-outline-primary ml-2">
            <Text id="integration.tesla.discoverTab" /> <i class="fe fe-radio" />
          </button>
        </Link>
      </div>
    </div>
  </div>
);

export default EmptyState;
