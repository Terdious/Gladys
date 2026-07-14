const sinon = require('sinon');

const { assert, fake } = sinon;

const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../../../../utils/constants');

const FrigateManager = require('../../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate emitStatusEvent', () => {
  afterEach(() => {
    sinon.reset();
  });

  it('should emit websocket status event', () => {
    const gladys = {
      event: {
        emit: fake.resolves(null),
      },
    };
    const frigateManager = new FrigateManager(gladys, null, serviceId);

    frigateManager.emitStatusEvent();

    assert.calledOnceWithExactly(gladys.event.emit, EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.FRIGATE.STATUS_CHANGE,
      payload: {
        mode: 'local',
        dockerBased: false,
        networkModeValid: false,
        frigateEnabled: false,
        mqttExist: false,
        mqttRunning: false,
        frigateExist: false,
        frigateRunning: false,
        gladysConnected: false,
        frigateConnected: false,
        vaapiAvailable: false,
        openvinoCapable: false,
        renderDevicePath: null,
        coralAvailable: false,
        coralDeviceType: null,
        detector: 'auto',
        mqttPort: null,
        frigateUiPort: null,
        frigateApiPort: null,
        frigateRtspPort: null,
      },
    });
  });
});
