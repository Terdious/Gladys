import { RequestStatus } from '../../../utils/consts';
import createBoxActions from '../boxActions';

const BOX_KEY = 'Camera';

function createActions(store) {
  const boxActions = createBoxActions(store);
  const actions = {
    async getCameraImage(state, box, x, y) {
      boxActions.updateBoxStatus(state, BOX_KEY, x, y, RequestStatus.Getting);
      try {
        const camera = await state.httpClient.get(`/api/v1/camera/${box.camera}`);

        console.log(camera)
        const image = camera.last_value_string
        
        actions.date = camera.updated_at
        boxActions.mergeBoxData(state, BOX_KEY, x, y, {
          image,
          date: camera.updated_at
        });
        boxActions.updateBoxStatus(state, BOX_KEY, x, y, RequestStatus.Success);
      } catch (e) {
        boxActions.mergeBoxData(state, BOX_KEY, x, y, {
          image: null,
          date: null
        });
        boxActions.updateBoxStatus(state, BOX_KEY, x, y, RequestStatus.Error);
      }
    },
    deviceFeatureWebsocketEvent(state, box, x, y, payload) {
      if (box.camera === payload.device) {
        boxActions.mergeBoxData(state, BOX_KEY, x, y, {
          image: payload.last_value_string,
          date: payload.updated_at
        });
      }
    }
  };
  return Object.assign({}, actions);
}

export default createActions;
