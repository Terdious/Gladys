import { Text } from 'preact-i18n';
import { RequestStatus } from '../../../../../utils/consts';
import style from './style.css';
import classNames from 'classnames/bind';

let cx = classNames.bind(style);

const CheckStatus = ({
  frigateEnabled,
  frigateExist,
  frigateRunning,
  dockerBased,
  networkModeValid,
  frigateStatus
}) => {
  let textLabel;
  let alertClass;
  if (frigateStatus === RequestStatus.Getting) {
    textLabel = 'integration.frigate.setup.activationFrigate';
    alertClass = 'alert-info';
  } else if (!dockerBased) {
    textLabel = 'integration.frigate.status.nonDockerEnv';
    alertClass = 'alert-danger';
  } else if (!networkModeValid) {
    textLabel = 'integration.frigate.status.invalidDockerNetwork';
    alertClass = 'alert-danger';
  } else if (!frigateEnabled) {
    textLabel = 'integration.frigate.status.notEnabled';
    alertClass = 'alert-info';
  } else if (!frigateExist) {
    textLabel = 'integration.frigate.status.notInstalled';
    alertClass = 'alert-danger';
  } else if (!frigateRunning) {
    textLabel = 'integration.frigate.status.notRunning';
    alertClass = 'alert-warning';
  } else {
    textLabel = 'integration.frigate.status.running';
    alertClass = 'alert-success';
  }

  return (
    <div>
      <div
        class={cx('d-flex', 'flex-row', 'flex-wrap', 'justify-content-between', 'mr-0', 'ml-0', 'alert', alertClass)}
      >
        <div class={cx(style.textAlignMiddleContainer)}>
          <span class={cx(style.textAlignMiddle)}>
            <Text id={textLabel} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default CheckStatus;
