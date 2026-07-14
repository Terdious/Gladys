import { RequestStatus } from '../../../../../utils/consts';
import {
  DEVICE_POLL_FREQUENCIES,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES
} from '../../../../../../../server/utils/constants';
import { CAMERA_PARAMS } from '../../../../../../../server/services/frigate/lib/constants';
import createActionsIntegration from '../../../../../actions/integration';

function createActions(store) {
  const integrationActions = createActionsIntegration(store);
  const actions = {
    async getFrigateStatus(state) {
      try {
        const frigateStatus = await state.httpClient.get('/api/v1/service/frigate/status');
        store.setState({
          frigateStatus
        });
      } catch (e) {
        store.setState({
          frigateStatus: null
        });
      }
    },
    async discoverRemoteCameras(state) {
      store.setState({ remoteCamerasStatus: RequestStatus.Getting });
      try {
        const remoteCameras = await state.httpClient.get('/api/v1/service/frigate/remote/cameras');
        store.setState({ remoteCameras, remoteCamerasStatus: RequestStatus.Success });
      } catch (e) {
        store.setState({ remoteCamerasStatus: RequestStatus.Error });
      }
    },
    async importRemoteCamera(state, remoteCamera) {
      await integrationActions.getIntegrationByName(state, 'frigate');
      const externalId = `frigate:${remoteCamera.name}`;
      // The Frigate friendly name is the human name of the camera; the slug
      // stays in the external id
      const displayName = remoteCamera.friendlyName || remoteCamera.name;
      const features = [
        {
          name: displayName,
          external_id: `${externalId}:image`,
          selector: `${externalId}:image`,
          category: DEVICE_FEATURE_CATEGORIES.CAMERA,
          type: DEVICE_FEATURE_TYPES.CAMERA.IMAGE,
          read_only: true,
          keep_history: false,
          has_feedback: false,
          min: 0,
          max: 0
        }
      ];
      remoteCamera.trackedLabels.forEach(label => {
        features.push({
          name: `${displayName} - ${label}`,
          external_id: `${externalId}:${label}`,
          selector: `${externalId}:${label}`,
          category: DEVICE_FEATURE_CATEGORIES.CAMERA,
          type: `${label}-detection`,
          read_only: true,
          keep_history: true,
          has_feedback: true,
          min: 0,
          max: 1
        });
        features.push({
          name: `${displayName} - ${label} (image)`,
          external_id: `${externalId}:${label}:image`,
          selector: `${externalId}:${label}:image`,
          category: DEVICE_FEATURE_CATEGORIES.CAMERA,
          type: DEVICE_FEATURE_TYPES.CAMERA.IMAGE,
          read_only: true,
          keep_history: false,
          has_feedback: false,
          min: 0,
          max: 0
        });
      });
      const params = [
        { name: CAMERA_PARAMS.SOURCE_TYPE, value: 'remote' },
        { name: CAMERA_PARAMS.TRACKED_LABELS, value: remoteCamera.trackedLabels.join(',') },
        { name: CAMERA_PARAMS.REMOTE_LABELS, value: remoteCamera.trackedLabels.join(',') }
      ];
      if (remoteCamera.sourceHost) {
        params.push({ name: CAMERA_PARAMS.REMOTE_SOURCE_HOST, value: remoteCamera.sourceHost });
      }
      const device = {
        name: displayName,
        external_id: externalId,
        selector: externalId,
        service_id: store.getState().currentIntegration.id,
        should_poll: true,
        poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
        features,
        params
      };
      await state.httpClient.post('/api/v1/device', device);
      await actions.discoverRemoteCameras(state);
    }
  };
  return actions;
}

export default createActions;
