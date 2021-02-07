import { RequestStatus } from '../utils/consts';
import update from 'immutability-helper';
import get from 'get-value';
import { route } from 'preact-router';

function createActions(store) {
  const actions = {
    checkErrors(state) {
      let newSceneErrors = {};
      if (!state.newScene.name) {
        newSceneErrors.name = true;
      }
      if (state.newScene.name === 'new') {
        newSceneErrors.name = true;
      }
      if (!state.newScene.icon) {
        newSceneErrors.icon = true;
      }
      store.setState({
        newSceneErrors
      });
      return Object.keys(newSceneErrors).length > 0;
    },
    async createScene(state, e) {
      console.log("coucou createScene")
      console.log(e)
      e.preventDefault();
      // if errored, we don't continue
      
      console.log(actions)
      if (actions.checkErrors(state)) {
        return;
      }
      store.setState({
        createSceneStatus: RequestStatus.Getting
      });
      try {
      console.log("coucou2 createScene")
      console.log(state.newScene)
        const createdScene = await state.httpClient.post('/api/v1/scene', state.newScene);
      console.log("coucou3 createScene")
        store.setState({
          createSceneStatus: RequestStatus.Success
        });
      console.log("coucou4 createScene")
        route(`/dashboard/scene/${createdScene.selector}`);
      } catch (e) {
        const status = get(e, 'response.status');
        if (status === 409) {
          store.setState({
            createSceneStatus: RequestStatus.ConflictError
          });
        } else {
          store.setState({
            createSceneStatus: RequestStatus.Error
          });
        }
      }
    },
    initScene(state) {
      store.setState({
        newScene: {
          name: null,
          icon: null,
          actions: [[]],
          group:[
              {
                groupPrimary: null,
                groupSecondary: null
              }
            ]
        },
        newSceneErrors: null,
        createSceneStatus: null
      });
    },
    updateNewSceneName(state, e) {
      const newState = update(state, {
        newScene: {
          name: {
            $set: e.target.value
          }
        }
      });
      store.setState(newState);
      if (state.newSceneErrors) {
        actions.checkErrors(store.getState());
      }
    },
    updateNewSceneGroupPrimary(state, e) {
      console.log("state")
      console.log(state)
      console.log("e")
      console.log(e)
      const newState = update(state, {
        newScene: {
          group: [{
            groupPrimary: {
              $set: e.target.value
            }
          }]
        }
      });
      store.setState(newState);
      if (state.newSceneErrors) {
        actions.checkErrors(store.getState());
      }
    },
    updateNewSceneGroupSecondary(state, e) {
      console.log("state")
      console.log(state)
      console.log("e")
      console.log(e)
      const newState = update(state, {
        newScene: {
          group: [{
            groupSecondary: {
              $set: e.target.value
            }
          }]
        }
      });
      store.setState(newState);
      if (state.newSceneErrors) {
        actions.checkErrors(store.getState());
      }
    },
    updateNewSceneIcon(state, e) {
      const newState = update(state, {
        newScene: {
          icon: {
            $set: e.target.value
          }
        }
      });
      store.setState(newState);
      if (state.newSceneErrors) {
        actions.checkErrors(store.getState());
      }
    }
  };
  return actions;
}

export default createActions;
