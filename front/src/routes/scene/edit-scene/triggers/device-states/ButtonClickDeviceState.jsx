import { Component, Fragment } from 'preact';
import Select from 'react-select';
import get from 'get-value';

import { BUTTON_STATUS } from '../../../../../../../server/utils/constants';
import withIntlAsProp from '../../../../../utils/withIntlAsProp';

class ButtonClickDeviceState extends Component {
  handleValueChange = ({ value }) => {
    this.props.updateTriggerProperty(this.props.index, 'value', value);
  };

  getOptions = () => {
    const { selectedDeviceFeature } = this.props;
    const supportedOptions =
      selectedDeviceFeature && Array.isArray(selectedDeviceFeature.supported_options)
        ? selectedDeviceFeature.supported_options
        : null;

    let options;
    if (supportedOptions && supportedOptions.length > 0) {
      // A device that declares supported_options only ever reports those states
      // (e.g. a doorbell button that solely "rings"): restrict the selector to
      // them. The integration label is the meaningful one, with the generic
      // button i18n label as a fallback when none is provided.
      options = [...supportedOptions]
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(option => ({
          label:
            option.label != null
              ? option.label
              : get(this.props.intl.dictionary, `deviceFeatureValue.category.button.click.${option.value}`, {
                  default: option.value
                }),
          value: option.value
        }));
    } else {
      options = Object.keys(BUTTON_STATUS).map(key => {
        const value = BUTTON_STATUS[key];
        return {
          label: get(this.props.intl.dictionary, `deviceFeatureValue.category.button.click.${value}`, {
            default: value
          }),
          value
        };
      });
    }

    this.setState({ options });
  };

  componentWillMount() {
    this.props.updateTriggerProperty(this.props.index, 'operator', '=');

    this.getOptions();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.selectedDeviceFeature !== this.props.selectedDeviceFeature) {
      this.getOptions();
    }
  }

  render({ trigger }, { options }) {
    const defaultValue = options.find(option => trigger.value === option.value);

    return (
      <Fragment>
        <div class="col-2 col-md-1">
          <div class="text-center" style={{ marginTop: '10px' }}>
            <i class="fe fe-arrow-right" style={{ fontSize: '20px' }} />
          </div>
        </div>
        <div class="col-10 col-md-5">
          <div class="form-group">
            <Select
              defaultValue={defaultValue || ''}
              onChange={this.handleValueChange}
              options={options}
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        </div>
      </Fragment>
    );
  }
}

export default withIntlAsProp(ButtonClickDeviceState);
