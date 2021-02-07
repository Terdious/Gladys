import { connect } from 'unistore/preact';
import { Text } from 'preact-i18n';
import { Link } from 'preact-router/match';
import actions from '../../actions/integration';

const SceneMenu = connect(
  'sceneGroups',
  actions
)(({ sceneGroups, getGroupsScene }) => {
  const refreshScenes = group => () => getGroupsScene(group);

  return (
    <div class="list-group list-group-transparent mb-0">
      {console.log(this)}
      <Link
        activeClassName="active"
        onClick={refreshScenes(null)}
        href="/dashboard/scene"
        class="list-group-item list-group-item-action d-flex align-items-center"
      >
        <span class="icon mr-3">
          <i class="fe fe-hash" />
        </span>
        <Text id="integration.root.menu.all" />
      </Link>
      {sceneGroups && sceneGroups.map(group => (
        <Link
          activeClassName="active"
          onClick={refreshScenes(group.primary)}
          href={`/dashboard/scene/${group.primary}`}
          class="list-group-item list-group-item-action d-flex align-items-center"
        >
          <span class="icon mr-3">
            <i class={`fe fe-grid`} />
          </span>
          <Text id={group.primary} />
        </Link>
      ))}
    </div>
  );
});

export default SceneMenu;
