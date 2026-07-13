import { Text } from 'preact-i18n';

import RelativeTime from '../../../../device/RelativeTime';

// One glyph per detectable object, so the room widget stays readable
// even with several detections on the same camera
const DETECTION_EMOJIS = {
  'person-detection': '🧍',
  'car-detection': '🚗',
  'dog-detection': '🐕',
  'cat-detection': '🐈',
  'horse-detection': '🐴',
  'bird-detection': '🐦',
  'bicycle-detection': '🚲',
  'motorcycle-detection': '🏍️',
  'bus-detection': '🚌',
  'truck-detection': '🚚'
};

const CameraDetectionDeviceValue = ({ deviceFeature, user }) => {
  const { type, last_value: lastValue, last_value_changed: lastValueChanged } = deviceFeature;
  const emoji = DETECTION_EMOJIS[type];
  if (lastValue) {
    return (
      <span class="badge badge-danger">
        {emoji} <Text id="dashboard.boxes.devicesInRoom.cameraDetectionInProgress" />
      </span>
    );
  }
  if (lastValueChanged) {
    return (
      <span>
        {emoji} <RelativeTime datetime={lastValueChanged} language={user ? user.language : null} futureDisabled />
      </span>
    );
  }
  return (
    <span>
      {emoji} <Text id="dashboard.boxes.devicesInRoom.noValue" />
    </span>
  );
};

export default CameraDetectionDeviceValue;
