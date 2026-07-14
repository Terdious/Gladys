import { RequestStatus } from '../../../../../utils/consts';
import update from 'immutability-helper';
import debounce from 'debounce';
import {
  DEVICE_POLL_FREQUENCIES,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES
} from '../../../../../../../server/utils/constants';
import { CAMERA_PARAMS, SOURCE_TYPES } from '../../../../../../../server/services/frigate/lib/constants';
import createActionsIntegration from '../../../../../actions/integration';

function sortRoomsInHouses(houses) {
  houses.forEach(house => house.rooms.sort((r1, r2) => r1.name.localeCompare(r2.name)));
}

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getParamValue(camera, paramName) {
  const param = (camera.params || []).find(({ name }) => name === paramName);
  return param ? param.value : null;
}

function createActions(store) {
  const integrationActions = createActionsIntegration(store);
  const actions = {
    complete(camera) {
      camera.catalogBrand = getParamValue(camera, CAMERA_PARAMS.CAMERA_BRAND);
      camera.catalogModel = getParamValue(camera, CAMERA_PARAMS.CAMERA_MODEL);
      camera.sourceType = getParamValue(camera, CAMERA_PARAMS.SOURCE_TYPE) || SOURCE_TYPES.RTSP;
      camera.host = getParamValue(camera, CAMERA_PARAMS.SOURCE_HOST);
      camera.username = getParamValue(camera, CAMERA_PARAMS.SOURCE_USERNAME);
      camera.password = getParamValue(camera, CAMERA_PARAMS.SOURCE_PASSWORD);
      camera.path = getParamValue(camera, CAMERA_PARAMS.SOURCE_PATH);
      camera.subPath = getParamValue(camera, CAMERA_PARAMS.SOURCE_SUB_PATH);
      camera.extra = getParamValue(camera, CAMERA_PARAMS.SOURCE_EXTRA);
      camera.sourceFilter = getParamValue(camera, CAMERA_PARAMS.SOURCE_FILTER);
      camera.customSource = getParamValue(camera, CAMERA_PARAMS.CUSTOM_SOURCE);
      camera.customSubSource = getParamValue(camera, CAMERA_PARAMS.CUSTOM_SUB_SOURCE);
      camera.tapoAuthVariant = getParamValue(camera, CAMERA_PARAMS.TAPO_AUTH_VARIANT);
      camera.rtspPort = getParamValue(camera, CAMERA_PARAMS.SOURCE_RTSP_PORT);
      camera.onvifPort = getParamValue(camera, CAMERA_PARAMS.ONVIF_PORT);
      camera.onvifUsername = getParamValue(camera, CAMERA_PARAMS.ONVIF_USERNAME);
      camera.onvifPassword = getParamValue(camera, CAMERA_PARAMS.ONVIF_PASSWORD);
      const labels = getParamValue(camera, CAMERA_PARAMS.TRACKED_LABELS);
      camera.labels = labels ? labels.split(',').filter(label => label.length > 0) : ['person'];
      return camera;
    },
    async getFrigateDevices(state) {
      store.setState({
        getFrigateCamerasStatus: RequestStatus.Getting
      });
      try {
        const options = {
          order_dir: state.getFrigateCamerasOrderDir || 'asc'
        };
        if (state.frigateCameraSearch && state.frigateCameraSearch.length) {
          options.search = state.frigateCameraSearch;
        }
        const frigateCameras = await state.httpClient.get('/api/v1/service/frigate/device', options);
        frigateCameras.forEach(camera => {
          actions.complete(camera);
        });
        store.setState({
          frigateCameras,
          getFrigateCamerasStatus: RequestStatus.Success
        });
      } catch (e) {
        store.setState({
          getFrigateCamerasStatus: RequestStatus.Error
        });
      }
    },
    async saveFrigateConfig(state) {
      // Regenerate the Frigate config file without restarting Frigate: the
      // user batches camera changes and reloads once with the restart button
      const configResult = await state.httpClient.post('/api/v1/service/frigate/config/save');
      store.setState({
        frigateStatus: {
          ...store.getState().frigateStatus,
          configPendingRestart: configResult.configPendingRestart
        }
      });
    },
    async restartFrigate(state) {
      store.setState({
        restartFrigateStatus: RequestStatus.Getting
      });
      try {
        await state.httpClient.post('/api/v1/service/frigate/config/restart');
        store.setState({
          restartFrigateStatus: RequestStatus.Success,
          frigateStatus: {
            ...store.getState().frigateStatus,
            configPendingRestart: false
          }
        });
      } catch (e) {
        store.setState({
          restartFrigateStatus: RequestStatus.Error
        });
      }
    },
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
    async getFrigateStats(state) {
      try {
        const frigateStats = await state.httpClient.get('/api/v1/service/frigate/stats');
        store.setState({
          frigateStats
        });
      } catch (e) {
        store.setState({
          frigateStats: null
        });
      }
    },
    async getHouses(state) {
      store.setState({
        housesGetStatus: RequestStatus.Getting
      });
      try {
        const params = {
          expand: 'rooms'
        };
        const housesWithRooms = await state.httpClient.get(`/api/v1/house`, params);
        sortRoomsInHouses(housesWithRooms);
        store.setState({
          housesWithRooms,
          housesGetStatus: RequestStatus.Success
        });
      } catch (e) {
        store.setState({
          housesGetStatus: RequestStatus.Error
        });
      }
    },
    async addCamera(state) {
      await integrationActions.getIntegrationByName(state, 'frigate');
      const frigateCameras = update(state.frigateCameras, {
        $push: [
          {
            name: null,
            should_poll: true,
            poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
            external_id: null,
            service_id: store.getState().currentIntegration.id,
            catalogBrand: null,
            catalogModel: null,
            sourceType: SOURCE_TYPES.RTSP,
            host: null,
            username: null,
            password: null,
            path: null,
            subPath: null,
            extra: null,
            customSource: null,
            customSubSource: null,
            tapoAuthVariant: null,
            rtspPort: null,
            onvifPort: null,
            onvifUsername: null,
            onvifPassword: null,
            labels: ['person'],
            features: [],
            params: []
          }
        ]
      });
      store.setState({
        frigateCameras
      });
    },
    updateCameraField(state, index, field, value) {
      const frigateCameras = update(state.frigateCameras, {
        [index]: {
          [field]: {
            $set: value
          }
        }
      });
      store.setState({
        frigateCameras
      });
    },
    applyCameraPreset(state, index, brandKey, modelName, preset) {
      const cameraUpdate = {
        catalogBrand: { $set: brandKey },
        catalogModel: { $set: modelName }
      };
      if (preset) {
        cameraUpdate.sourceType = { $set: preset.sourceType };
        cameraUpdate.path = { $set: preset.path || null };
        cameraUpdate.subPath = { $set: preset.subPath || null };
        cameraUpdate.extra = { $set: preset.extra || null };
        cameraUpdate.sourceFilter = { $set: preset.sourceFilter || null };
        cameraUpdate.rtspPort = { $set: preset.rtspPort ? `${preset.rtspPort}` : null };
        cameraUpdate.onvifPort = { $set: preset.onvifPort ? `${preset.onvifPort}` : null };
        cameraUpdate.customSource = { $set: null };
        cameraUpdate.customSubSource = { $set: null };
      }
      const frigateCameras = update(state.frigateCameras, {
        [index]: cameraUpdate
      });
      store.setState({
        frigateCameras
      });
    },
    toggleCameraLabel(state, index, label) {
      const camera = state.frigateCameras[index];
      const labels = camera.labels.includes(label)
        ? camera.labels.filter(cameraLabel => cameraLabel !== label)
        : [...camera.labels, label];
      actions.updateCameraField(state, index, 'labels', labels);
    },
    async saveCamera(state, index) {
      const camera = state.frigateCameras[index];
      const cameraName = slugify(camera.name);
      const externalId = camera.created_at ? camera.external_id : `frigate:${cameraName}`;

      const params = [
        { name: CAMERA_PARAMS.CAMERA_BRAND, value: camera.catalogBrand },
        { name: CAMERA_PARAMS.CAMERA_MODEL, value: camera.catalogModel },
        { name: CAMERA_PARAMS.SOURCE_TYPE, value: camera.sourceType },
        { name: CAMERA_PARAMS.SOURCE_HOST, value: camera.host && camera.host.trim() },
        { name: CAMERA_PARAMS.SOURCE_USERNAME, value: camera.username },
        { name: CAMERA_PARAMS.SOURCE_PASSWORD, value: camera.password },
        { name: CAMERA_PARAMS.SOURCE_PATH, value: camera.path },
        { name: CAMERA_PARAMS.SOURCE_SUB_PATH, value: camera.subPath },
        { name: CAMERA_PARAMS.SOURCE_EXTRA, value: camera.extra },
        { name: CAMERA_PARAMS.SOURCE_FILTER, value: camera.sourceFilter },
        { name: CAMERA_PARAMS.CUSTOM_SOURCE, value: camera.customSource && camera.customSource.trim() },
        { name: CAMERA_PARAMS.CUSTOM_SUB_SOURCE, value: camera.customSubSource && camera.customSubSource.trim() },
        { name: CAMERA_PARAMS.TAPO_AUTH_VARIANT, value: camera.tapoAuthVariant },
        { name: CAMERA_PARAMS.SOURCE_RTSP_PORT, value: camera.rtspPort },
        { name: CAMERA_PARAMS.ONVIF_PORT, value: camera.onvifPort },
        { name: CAMERA_PARAMS.ONVIF_USERNAME, value: camera.onvifUsername },
        { name: CAMERA_PARAMS.ONVIF_PASSWORD, value: camera.onvifPassword },
        { name: CAMERA_PARAMS.TRACKED_LABELS, value: camera.labels.join(',') }
      ].filter(param => param.value !== null && param.value !== undefined && param.value !== '');

      const features = [];
      const existingImageFeature = (camera.features || []).find(
        feature => feature.category === DEVICE_FEATURE_CATEGORIES.CAMERA
      );
      if (existingImageFeature) {
        const imageFeature = { ...existingImageFeature, name: camera.name };
        delete imageFeature.last_value_string;
        features.push(imageFeature);
      } else {
        features.push({
          name: camera.name,
          external_id: `${externalId}:image`,
          selector: `${externalId}:image`,
          category: DEVICE_FEATURE_CATEGORIES.CAMERA,
          type: DEVICE_FEATURE_TYPES.CAMERA.IMAGE,
          read_only: true,
          keep_history: false,
          has_feedback: false,
          min: 0,
          max: 0
        });
      }
      camera.labels.forEach(label => {
        const featureExternalId = `${externalId}:${label}`;
        const existingFeature = (camera.features || []).find(feature => feature.external_id === featureExternalId);
        features.push(
          existingFeature || {
            name: `${camera.name} - ${label}`,
            external_id: featureExternalId,
            selector: featureExternalId,
            category: DEVICE_FEATURE_CATEGORIES.MOTION_SENSOR,
            type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
            read_only: true,
            keep_history: true,
            has_feedback: true,
            min: 0,
            max: 1
          }
        );
      });

      const deviceToSave = {
        id: camera.id,
        name: camera.name,
        selector: camera.selector,
        room_id: camera.room_id,
        external_id: externalId,
        service_id: camera.service_id,
        should_poll: camera.should_poll,
        poll_frequency: camera.poll_frequency,
        features,
        params
      };

      let newCamera = await state.httpClient.post(`/api/v1/device`, deviceToSave);
      await actions.saveFrigateConfig(state);
      newCamera = actions.complete(newCamera);
      const frigateCameras = update(state.frigateCameras, {
        [index]: {
          $set: newCamera
        }
      });
      store.setState({
        frigateCameras
      });
    },
    async deleteCamera(state, index) {
      const camera = state.frigateCameras[index];
      if (camera.created_at) {
        await state.httpClient.delete(`/api/v1/device/${camera.selector}`);
        await actions.saveFrigateConfig(state);
      }
      const frigateCameras = update(state.frigateCameras, {
        $splice: [[index, 1]]
      });
      store.setState({
        frigateCameras
      });
    },
    async search(state, e) {
      store.setState({
        frigateCameraSearch: e.target.value
      });
      await actions.getFrigateDevices(store.getState());
    },
    async changeOrderDir(state, e) {
      store.setState({
        getFrigateCamerasOrderDir: e.target.value
      });
      await actions.getFrigateDevices(store.getState());
    }
  };
  actions.debouncedSearch = debounce(actions.search, 200);

  return Object.assign({}, integrationActions, actions);
}

export default createActions;
