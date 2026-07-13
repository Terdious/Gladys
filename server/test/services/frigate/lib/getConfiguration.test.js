const { expect } = require('chai');
const sinon = require('sinon');

const { fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate getConfiguration', () => {
  afterEach(() => {
    sinon.reset();
  });

  it('should load stored configuration', async () => {
    const variables = {
      FRIGATE_ENABLED: '1',
      FRIGATE_GLADYS_MQTT_USERNAME: 'gladys',
      FRIGATE_GLADYS_MQTT_PASSWORD: 'gladys-password',
      FRIGATE_MQTT_USERNAME: 'frigate',
      FRIGATE_MQTT_PASSWORD: 'frigate-password',
      FRIGATE_MQTT_PORT: '1885',
      FRIGATE_UI_PORT: '8971',
      FRIGATE_API_PORT: '5000',
      FRIGATE_RTSP_PORT: '8554',
      FRIGATE_DOCKER_MQTT_VERSION: '1',
      FRIGATE_DOCKER_FRIGATE_VERSION: '1',
      FRIGATE_RECORD_CONTINUOUS_DAYS: '10',
      FRIGATE_RECORD_ALERTS_DAYS: '30',
      FRIGATE_RECORD_DETECTIONS_DAYS: '14',
      TIMEZONE: 'Europe/Paris',
    };
    const gladys = {
      variable: {
        getValue: fake((key) => Promise.resolve(variables[key] || null)),
      },
    };
    const frigateManager = new FrigateManager(gladys, null, serviceId);

    const configuration = await frigateManager.getConfiguration();

    expect(configuration).to.deep.equal({
      frigateEnabled: true,
      mqttUsername: 'gladys',
      mqttPassword: 'gladys-password',
      frigateMqttUsername: 'frigate',
      frigateMqttPassword: 'frigate-password',
      mqttPort: '1885',
      frigateUiPort: '8971',
      frigateApiPort: '5000',
      frigateRtspPort: '8554',
      dockerMqttVersion: '1',
      dockerFrigateVersion: '1',
      recordContinuousDays: '10',
      recordAlertsDays: '30',
      recordDetectionsDays: '14',
      timezone: 'Europe/Paris',
    });
  });

  it('should return disabled configuration when nothing is stored', async () => {
    const gladys = {
      variable: {
        getValue: fake.resolves(null),
      },
    };
    const frigateManager = new FrigateManager(gladys, null, serviceId);

    const configuration = await frigateManager.getConfiguration();

    expect(configuration).to.deep.equal({
      frigateEnabled: false,
      mqttUsername: null,
      mqttPassword: null,
      frigateMqttUsername: null,
      frigateMqttPassword: null,
      mqttPort: null,
      frigateUiPort: null,
      frigateApiPort: null,
      frigateRtspPort: null,
      dockerMqttVersion: null,
      dockerFrigateVersion: null,
      recordContinuousDays: null,
      recordAlertsDays: null,
      recordDetectionsDays: null,
      timezone: null,
    });
  });
});
