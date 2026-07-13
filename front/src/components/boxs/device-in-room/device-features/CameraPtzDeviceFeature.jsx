import { Component } from 'preact';
import get from 'get-value';

import { DEVICE_FEATURE_TYPES } from '../../../../../../server/utils/constants';
import { DeviceFeatureCategoriesIcon } from '../../../../utils/consts';

// Icons of the two directions of each PTZ axis (-1 / +1)
const AXIS_ICONS = {
  [DEVICE_FEATURE_TYPES.CAMERA.PAN]: { negative: 'arrow-left', positive: 'arrow-right' },
  [DEVICE_FEATURE_TYPES.CAMERA.TILT]: { negative: 'arrow-down', positive: 'arrow-up' },
  [DEVICE_FEATURE_TYPES.CAMERA.ZOOM]: { negative: 'zoom-out', positive: 'zoom-in' }
};

class CameraPtzDeviceFeature extends Component {
  // Press and hold to move, release to stop: works for continuous PTZ (ONVIF)
  // and single-step cameras alike. The non-debounced updateValue is used so
  // the move is never swallowed by the stop.
  startMove = direction => () => {
    this.props.updateValue(this.props.deviceFeature, direction);
  };

  stopMove = () => {
    this.props.updateValue(this.props.deviceFeature, 0);
  };

  render({ deviceFeature, rowName }) {
    const { category, type } = deviceFeature;
    const icons = AXIS_ICONS[type];
    return (
      <tr>
        <td>
          <i class={`fe fe-${get(DeviceFeatureCategoriesIcon, `${category}.${type}`, { default: 'sliders' })}`} />
        </td>
        <td>{rowName}</td>
        <td class="py-0">
          <div class="d-flex justify-content-end">
            <div class="btn-group" role="group">
              <button
                class="btn btn-sm btn-secondary"
                onMouseDown={this.startMove(-1)}
                onMouseUp={this.stopMove}
                onMouseLeave={this.stopMove}
                onTouchStart={this.startMove(-1)}
                onTouchEnd={this.stopMove}
              >
                <i class={`fe fe-${icons.negative}`} />
              </button>
              <button
                class="btn btn-sm btn-secondary"
                onMouseDown={this.startMove(1)}
                onMouseUp={this.stopMove}
                onMouseLeave={this.stopMove}
                onTouchStart={this.startMove(1)}
                onTouchEnd={this.stopMove}
              >
                <i class={`fe fe-${icons.positive}`} />
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }
}

export default CameraPtzDeviceFeature;
