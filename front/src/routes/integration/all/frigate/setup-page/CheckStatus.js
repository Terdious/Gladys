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
  let textLabel = null;
  if (frigateStatus === RequestStatus.Getting) {
    textLabel = 'integration.frigate.setup.activationFrigate';
  } else if (!dockerBased) {
    textLabel = 'integration.frigate.status.nonDockerEnv';
  } else if (!networkModeValid) {
    textLabel = 'integration.frigate.status.invalidDockerNetwork';
  } else if (frigateEnabled) {
    if (!frigateExist) {
      textLabel = 'integration.frigate.status.notInstalled';
    } else if (!frigateRunning) {
      textLabel = 'integration.frigate.status.notRunning';
    } else {
      textLabel = 'integration.frigate.status.running';
    }
  } else {
    textLabel = 'integration.frigate.status.notEnabled';
  }

  return (
    <div>
      <div
        class={cx('d-flex', 'flex-row', 'flex-wrap', 'justify-content-between', 'mr-0', 'ml-0', 'alert', {
          'alert-success': frigateEnabled && frigateExist && frigateRunning,
          'alert-warning': frigateEnabled && frigateExist && !frigateRunning,
          'alert-danger': (frigateEnabled && !frigateExist) || !dockerBased || !networkModeValid,
          'alert-info': !frigateEnabled
        })}
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
