import { Text } from 'preact-i18n';
import cx from 'classnames';

import FrigatePage from '../FrigatePage';
import { RequestStatus } from '../../../../../utils/consts';

const FrigateDiscoverPage = props => (
  <FrigatePage user={props.user}>
    <div class="card">
      <div class="card-header">
        <h1 class="card-title">
          <Text id="integration.frigate.discover.title" />
        </h1>
        {props.frigateStatus && props.frigateStatus.mode === 'remote' && (
          <div class="page-options d-flex">
            <button
              onClick={props.discoverRemoteCameras}
              class={cx('btn btn-outline-primary', {
                'btn-loading': props.remoteCamerasStatus === RequestStatus.Getting
              })}
              disabled={props.remoteCamerasStatus === RequestStatus.Getting}
            >
              <span class="d-none d-lg-inline-block mr-2">
                <Text id="integration.frigate.discover.scanButton" />
              </span>
              <i class="fe fe-radio" />
            </button>
          </div>
        )}
      </div>
      <div class="card-body">
        {(!props.frigateStatus || props.frigateStatus.mode !== 'remote') && (
          <div class="alert alert-info">
            <Text id="integration.frigate.discover.localModeInfo" />
          </div>
        )}
        {props.frigateStatus && props.frigateStatus.mode === 'remote' && (
          <div
            class={cx('dimmer', {
              active: props.remoteCamerasStatus === RequestStatus.Getting
            })}
          >
            <div class="loader" />
            <div class="dimmer-content">
              {props.remoteCamerasStatus === RequestStatus.Error && (
                <div class="alert alert-danger">
                  <Text id="integration.frigate.discover.error" />
                </div>
              )}
              {props.remoteCameras && props.remoteCameras.length === 0 && (
                <div class="alert alert-info">
                  <Text id="integration.frigate.discover.emptyState" />
                </div>
              )}
              {props.remoteCameras && props.remoteCameras.length > 0 && (
                <table class="table table-responsive table-sm">
                  <thead>
                    <tr>
                      <th>
                        <Text id="integration.frigate.discover.nameColumn" />
                      </th>
                      <th>
                        <Text id="integration.frigate.discover.sourceColumn" />
                      </th>
                      <th>
                        <Text id="integration.frigate.discover.labelsColumn" />
                      </th>
                      <th class="text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {props.remoteCameras.map(remoteCamera => (
                      <tr>
                        <td>
                          {remoteCamera.friendlyName || remoteCamera.name}
                          <div>
                            <small class="text-muted">{remoteCamera.name}</small>
                          </div>
                        </td>
                        <td>{remoteCamera.sourceHost}</td>
                        <td>
                          {remoteCamera.trackedLabels.map(label => (
                            <span class="tag mr-1">{label}</span>
                          ))}
                        </td>
                        <td class="text-right">
                          {remoteCamera.alreadyImported ? (
                            <span class="tag tag-success">
                              <Text id="integration.frigate.discover.alreadyImported" />
                            </span>
                          ) : (
                            <button
                              class="btn btn-sm btn-primary"
                              onClick={() => props.importRemoteCamera(remoteCamera)}
                            >
                              <Text id="integration.frigate.discover.importButton" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </FrigatePage>
);

export default FrigateDiscoverPage;
