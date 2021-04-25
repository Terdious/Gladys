import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { Text } from 'preact-i18n';
import Select from 'react-select';
import withIntlAsProp from '../../../../utils/withIntlAsProp';

import { ACTIONS } from '../../../../../../server/utils/constants';
import { getDeviceFeatureName } from '../../../../utils/device';

@connect('httpClient', {})
class TurnOnOffSwitch extends Component {
  getOptions = async () => {
    try {
      // we get the rooms with the devices
      const rooms = await this.props.httpClient.get('/api/v1/room?expand=devices', {
        device_feature_category: 'switch',
        device_feature_type: 'binary'
      });
      const deviceOptions = [];
      const deviceDictionnary = {};
      const deviceFeaturesDictionnary = {};
      // and compose the multi-level options
      rooms.forEach(room => {
        const roomDeviceFeatures = [];
        room.devices.forEach(device => {
          device.features.forEach(feature => {
            if (feature.category === 'switch' && feature.type === 'binary' && feature.read_only === false) {
              // keep device / deviceFeature in dictionnary
              deviceFeaturesDictionnary[feature.selector] = feature;
              deviceDictionnary[feature.selector] = device;
              roomDeviceFeatures.push({
                value: feature.selector,
                label: getDeviceFeatureName(this.props.intl.dictionary, device, feature) //this.context.
              });
            }
          });
        });
        if (roomDeviceFeatures.length > 0) {
          roomDeviceFeatures.sort((a, b) => {
            if (a.label < b.label) {
              return -1;
            } else if (a.label > b.label) {
              return 1;
            }
            return 0;
          });
          deviceOptions.push({
            label: room.name,
            options: roomDeviceFeatures
          });
        }
      });
      await this.setState({ deviceOptions, deviceFeaturesDictionnary, deviceDictionnary });
      await this.refreshSelectedOptions(this.props);
      return deviceOptions;
    } catch (e) {
      console.error(e);
    }
  };
 /* handleChange = selectedOptions => {
    if (selectedOptions) {
      const switches = selectedOptions.map(selectedOption => selectedOption.value);
      this.props.updateActionProperty(this.props.columnIndex, this.props.index, 'devices', switches);
    } else {
      this.props.updateActionProperty(this.props.columnIndex, this.props.index, 'devices', []);
    }
  };*/
  handleChange = selectedOptions => {
    //const { deviceFeaturesDictionnary, deviceDictionnary } = this.state;
    const switches = selectedOptions.map(selectedOption => selectedOption.value);
    if (selectedOptions) {
      this.props.updateActionProperty(this.props.columnIndex, this.props.index, 'device_features', switches);
    } else {
      this.props.updateActionProperty(this.props.columnIndex, this.props.index, 'device_features', []);
    }
    //this.setState({ selectedOptions }); // this.setState({ deviceFeature, device });
  };
  refreshSelectedOptions = nextProps => {
    const selectedOptions = [];
    if (nextProps.action.device_features && this.state.deviceOptions) {
      nextProps.action.device_features.forEach(switchBinary => {
        this.state.deviceOptions.forEach(room => {
          const deviceOption = room.options.find(deviceOption => deviceOption.value === switchBinary);
          if (deviceOption) {
            selectedOptions.push(deviceOption);
          }
        });
      });
    }
    this.setState({ selectedOptions });
  };
  constructor(props) {
    super(props);
    this.state = {
      deviceOptions: null,
      selectedOptions: []
    };
  }
  async componentDidMount() {
    this.getOptions();
  }

  componentWillReceiveProps(nextProps) {
    this.refreshSelectedOptions(nextProps);
  }

  render(props, { selectedOptions, deviceOptions }) {
    return (
      <div class="form-group">
        <label class="form-label">
          {props.action.type === ACTIONS.SWITCH.TURN_ON && <Text id="editScene.actionsCard.turnOnSwitches.label" />}
          {props.action.type === ACTIONS.SWITCH.TURN_OFF && <Text id="editScene.actionsCard.turnOffSwitches.label" />}
        </label>
        <Select
          defaultValue={[]}
          isMulti
          value={selectedOptions}
          onChange={this.handleChange}
          options={deviceOptions}
        />
      </div>
    );
  }
}

export default withIntlAsProp(TurnOnOffSwitch);
