import { Text, MarkupText, Localizer } from 'preact-i18n';
import cx from 'classnames';

import FrigatePage from '../FrigatePage';
import FrigateCameraBox from './FrigateCameraBox';
import { RequestStatus } from '../../../../../utils/consts';
import CardFilter from '../../../../../components/layout/CardFilter';

const FrigateDevicesPage = props => (
  <FrigatePage user={props.user}>
    {props.frigateStatus && !props.frigateStatus.frigateEnabled && (
      <div class="alert alert-warning">
        <MarkupText id="integration.frigate.device.notEnabledWarning" />
      </div>
    )}
    {props.frigateStatus && props.frigateStatus.frigateEnabled && props.frigateStatus.configPendingRestart && (
      <div class="alert alert-warning d-flex align-items-center justify-content-between flex-wrap">
        <span class="mr-2">
          <Text id="integration.frigate.device.pendingRestartWarning" />
        </span>
        <button
          onClick={props.restartFrigate}
          class={cx('btn btn-warning', {
            'btn-loading': props.restartFrigateStatus === RequestStatus.Getting
          })}
          disabled={props.restartFrigateStatus === RequestStatus.Getting}
        >
          <i class="fe fe-refresh-cw mr-2" />
          <Text id="integration.frigate.device.restartButton" />
        </button>
      </div>
    )}
    {props.restartFrigateStatus === RequestStatus.Error && (
      <div class="alert alert-danger">
        <Text id="integration.frigate.device.restartError" />
      </div>
    )}
    <div class="card">
      <div class="card-header">
        <h1 class="card-title d-none d-lg-inline-block">
          <Text id="integration.frigate.device.title" />
        </h1>
        <div class="page-options d-flex">
          <Localizer>
            <CardFilter
              changeOrderDir={props.changeOrderDir}
              orderValue={props.getFrigateCamerasOrderDir}
              search={props.debouncedSearch}
              searchValue={props.frigateCameraSearch}
              searchPlaceHolder={<Text id="integration.frigate.device.search" />}
            />
          </Localizer>
          {(!props.frigateStatus || props.frigateStatus.mode !== 'remote') && (
            <button onClick={props.addCamera} class="btn btn-outline-primary ml-2">
              <span class="d-none d-lg-inline-block mr-2">
                <Text id="scene.newButton" />
              </span>
              <i class="fe fe-plus" />
            </button>
          )}
          {props.frigateStatus && props.frigateStatus.mode === 'remote' && (
            <button onClick={props.discoverRemoteCameras} class="btn btn-outline-primary ml-2">
              <span class="d-none d-lg-inline-block mr-2">
                <Text id="integration.frigate.device.discoverRemoteButton" />
              </span>
              <i class="fe fe-radio" />
            </button>
          )}
        </div>
      </div>
      <div class="card-body">
        {props.frigateStatus && props.frigateStatus.mode === 'remote' && props.remoteCameras && (
          <div class="mb-4">
            <h4>
              <Text id="integration.frigate.device.remoteCamerasTitle" />
            </h4>
            {props.remoteCameras.length === 0 && (
              <div class="alert alert-info">
                <Text id="integration.frigate.device.remoteCamerasEmpty" />
              </div>
            )}
            {props.remoteCameras.length > 0 && (
              <table class="table table-sm table-striped">
                <tbody>
                  {props.remoteCameras.map(remoteCamera => (
                    <tr>
                      <td>{remoteCamera.name}</td>
                      <td>
                        {remoteCamera.trackedLabels.map(label => (
                          <span class="tag mr-1">{label}</span>
                        ))}
                      </td>
                      <td class="text-right">
                        {remoteCamera.alreadyImported ? (
                          <span class="tag tag-success">
                            <Text id="integration.frigate.device.alreadyImported" />
                          </span>
                        ) : (
                          <button
                            class="btn btn-sm btn-primary"
                            onClick={() => props.importRemoteCamera(remoteCamera)}
                          >
                            <Text id="integration.frigate.device.importButton" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        <div
          class={cx('dimmer', {
            active: props.getFrigateCamerasStatus === RequestStatus.Getting
          })}
        >
          <div class="loader" />
          <div class="dimmer-content">
            <div class="row">
              {props.frigateCameras &&
                props.frigateCameras.map((camera, index) => (
                  <FrigateCameraBox
                    camera={camera}
                    cameraIndex={index}
                    housesWithRooms={props.housesWithRooms}
                    frigateStats={props.frigateStats}
                    updateCameraField={props.updateCameraField}
                    toggleCameraLabel={props.toggleCameraLabel}
                    applyCameraPreset={props.applyCameraPreset}
                    saveCamera={props.saveCamera}
                    deleteCamera={props.deleteCamera}
                    httpClient={props.httpClient}
                  />
                ))}
              {props.frigateCameras && props.frigateCameras.length === 0 && (
                <div class="col-md-12">
                  <div class="alert alert-info">
                    <Text id="integration.frigate.device.emptyState" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </FrigatePage>
);

export default FrigateDevicesPage;
