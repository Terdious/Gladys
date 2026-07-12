const sinon = require('sinon');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate saveConfiguration', () => {
  afterEach(() => {
    sinon.reset();
  });

  it('should store defined values and destroy missing ones', async () => {
    const gladys = {
      variable: {
        setValue: fake.resolves(null),
        destroy: fake.resolves(null),
      },
    };
    const frigateManager = new FrigateManager(gladys, null, serviceId);

    await frigateManager.saveConfiguration({
      mqttUsername: 'gladys',
      mqttPassword: 'gladys-password',
      frigateMqttUsername: 'frigate',
      frigateMqttPassword: 'frigate-password',
      mqttPort: 1885,
      frigateUiPort: 8971,
      frigateApiPort: 5000,
      frigateRtspPort: 8554,
      dockerMqttVersion: '1',
      // dockerFrigateVersion is intentionally missing
    });

    assert.callCount(gladys.variable.setValue, 9);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_GLADYS_MQTT_USERNAME', 'gladys', serviceId);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_GLADYS_MQTT_PASSWORD', 'gladys-password', serviceId);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_MQTT_USERNAME', 'frigate', serviceId);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_MQTT_PASSWORD', 'frigate-password', serviceId);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_MQTT_PORT', 1885, serviceId);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_UI_PORT', 8971, serviceId);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_API_PORT', 5000, serviceId);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_RTSP_PORT', 8554, serviceId);
    assert.calledWith(gladys.variable.setValue, 'FRIGATE_DOCKER_MQTT_VERSION', '1', serviceId);
    assert.calledOnceWithExactly(gladys.variable.destroy, 'FRIGATE_DOCKER_FRIGATE_VERSION', serviceId);
  });
});
