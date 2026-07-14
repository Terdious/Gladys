import { Component } from 'preact';
import { connect } from 'unistore/preact';
import { Text, Localizer } from 'preact-i18n';
import BaseEditBox from '../baseEditBox';
import { DEVICE_FEATURE_TYPES } from '../../../../../server/utils/constants';

const EditCameraImageBox = ({ children, ...props }) => (
  <BaseEditBox {...props} titleKey="dashboard.boxTitle.camera-image" titleValue={props.box.name}>
    <div class="form-group">
      <label>
        <Text id="dashboard.boxes.cameraImage.editCameraLabel" />
      </label>
      <select onChange={props.updateCamera} class="form-control">
        <option value="">
          <Text id="global.emptySelectOption" />
        </option>
        {props.cameras &&
          props.cameras.map(camera => (
            <option selected={camera.selector === props.box.camera} value={camera.selector}>
              {camera.name}
            </option>
          ))}
      </select>
    </div>
    {props.selectedCameraImageFeatures && (
      <div class="form-group">
        <label>
          <Text id="dashboard.boxes.cameraImage.editImageFeatureLabel" />
        </label>
        <select onChange={props.updateCameraFeature} class="form-control">
          <option value="">
            <Text id="global.emptySelectOption" />
          </option>
          {props.selectedCameraImageFeatures.map(feature => (
            <option selected={feature.selector === props.box.camera_feature} value={feature.selector}>
              {feature.name}
            </option>
          ))}
        </select>
        <p class="mt-1 mb-0">
          <small class="text-muted">
            <Text id="dashboard.boxes.cameraImage.editImageFeatureDescription" />
          </small>
        </p>
      </div>
    )}
    <div class="form-group">
      <label>
        <Text id="dashboard.boxes.cameraImage.editBoxNameLabel" />
      </label>
      <Localizer>
        <input
          type="text"
          value={props.box.name}
          onInput={props.updateBoxName}
          class="form-control"
          placeholder={<Text id="dashboard.boxes.cameraImage.editBoxNamePlaceholder" />}
        />
      </Localizer>
    </div>
  </BaseEditBox>
);

class EditCameraImageBoxComponent extends Component {
  updateCamera = e => {
    this.props.updateBoxConfig(this.props.x, this.props.y, {
      camera: e.target.value,
      // The selected image feature belongs to the previous camera
      camera_feature: null
    });
  };

  updateCameraFeature = e => {
    this.props.updateBoxConfig(this.props.x, this.props.y, {
      camera_feature: e.target.value === '' ? null : e.target.value
    });
  };

  updateBoxName = e => {
    this.props.updateBoxConfig(this.props.x, this.props.y, {
      name: e.target.value
    });
  };

  getCameras = async () => {
    await this.setState({
      loading: true
    });
    try {
      const cameras = await this.props.httpClient.get('/api/v1/camera');
      this.setState({
        cameras,
        loading: false
      });
    } catch (e) {
      this.setState({
        loading: false
      });
    }
  };

  componentDidMount() {
    this.getCameras();
  }

  render(props, { cameras }) {
    const selectedCamera = cameras && cameras.find(camera => camera.selector === props.box.camera);
    const selectedCameraImageFeatures =
      selectedCamera && selectedCamera.features
        ? selectedCamera.features.filter(feature => feature.type === DEVICE_FEATURE_TYPES.CAMERA.IMAGE)
        : null;
    return (
      <EditCameraImageBox
        {...props}
        cameras={cameras}
        selectedCameraImageFeatures={selectedCameraImageFeatures}
        updateCamera={this.updateCamera}
        updateCameraFeature={this.updateCameraFeature}
        updateBoxName={this.updateBoxName}
      />
    );
  }
}

export default connect('httpClient', {})(EditCameraImageBoxComponent);
