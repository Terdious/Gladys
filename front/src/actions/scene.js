import { RequestStatus } from '../utils/consts';
import update, { extend } from 'immutability-helper';
import debounce from 'debounce';

extend('$auto', function(value, object) {
  return object ? update(object, value) : update({}, value);
});

function createActions(store) {
  const actions = {
    async getScenes(state) {
        console.log("Coucou")
      store.setState({
        scenesGetStatus: RequestStatus.Getting
      });
      try {
        const orderDir = state.getScenesOrderDir || 'asc';
        const params = {
          order_dir: orderDir
        };
        if (state.sceneSearch && state.sceneSearch.length) {
          params.search = state.sceneSearch;
        }
        console.log(params)
        const scenes = await state.httpClient.get('/api/v1/scene', params);
        store.setState({
          scenes,
          scenesGetStatus: RequestStatus.Success
        });
      } catch (e) {
        store.setState({
          scenesGetStatus: RequestStatus.Error
        });
      }
    },
    async getGroupsScene(state,groups) {
      store.setState({
        scenesGetStatus: RequestStatus.Getting
      });
      try {
        const orderDir = state.getScenesOrderDir || 'asc';
        const params = {
          order_dir: orderDir
        };
        if (state.sceneSearch && state.sceneSearch.length) {
          params.search = state.sceneSearch;
        }
        console.log("Coucou2")
        const scenes = await state.httpClient.get('/api/v1/scene/:scene_group', params);
        sceneGroups.map(group => {

        })
        store.setState({
          scenes,
          scenesGetStatus: RequestStatus.Success
        });
      } catch (e) {
        store.setState({
          scenesGetStatus: RequestStatus.Error
        });
      }

      const selectedIntegrations = sceneBy[group] || scenes;
      store.setState({
        integrations: selectedIntegrations,
        totalSize: selectedIntegrations.length,
        sceneGroups: groups,
        searchKeyword: ''
      });
    },
    async search(state, e) {
      store.setState({
        sceneSearch: e.target.value
      });
      await actions.getScenes(store.getState());
    },
    async changeOrderDir(state, e) {
      store.setState({
        getScenesOrderDir: e.target.value
      });
      await actions.getScenes(store.getState());
    }
  };
  actions.debouncedSearch = debounce(actions.search, 200);
  return actions;
}

export default createActions;
