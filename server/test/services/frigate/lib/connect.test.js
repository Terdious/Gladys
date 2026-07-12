const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');

const { assert, fake } = sinon;

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

const configuration = { mqttUrl: 'fakeUrl', mqttUsername: 'username', mqttPassword: 'password' };

describe('frigate connect', () => {
  let frigateManager;
  let gladys;
  let mqttLibrary;
  let mqttClient;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
    };

    const eventMqtt = new EventEmitter();
    mqttClient = Object.assign(eventMqtt, {
      subscribe: fake.resolves(null),
      end: fake.resolves(null),
      removeAllListeners: fake.resolves(null),
    });
    mqttLibrary = {
      connect: fake.returns(mqttClient),
    };

    frigateManager = new FrigateManager(gladys, mqttLibrary, serviceId);
    frigateManager.dockerBased = true;
    frigateManager.networkModeValid = true;
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should disconnect existing client and not reconnect when mqtt is not running', async () => {
    frigateManager.mqttRunning = false;
    frigateManager.mqttClient = mqttClient;

    await frigateManager.connect(configuration);

    assert.notCalled(mqttLibrary.connect);
    assert.calledOnceWithExactly(mqttClient.end);
    assert.calledOnceWithExactly(mqttClient.removeAllListeners);
    expect(frigateManager.mqttClient).to.eq(null);
  });

  it('should not try to connect to mqtt', async () => {
    frigateManager.mqttRunning = false;

    await frigateManager.connect(configuration);

    assert.notCalled(mqttLibrary.connect);
    assert.notCalled(mqttClient.end);
    assert.notCalled(gladys.event.emit);
  });

  it('should try to connect to mqtt', async () => {
    frigateManager.mqttRunning = true;

    await frigateManager.connect(configuration);

    assert.calledOnce(mqttLibrary.connect);
    assert.calledWithMatch(
      mqttLibrary.connect,
      configuration.mqttUrl,
      sinon.match({
        username: configuration.mqttUsername,
        password: configuration.mqttPassword,
        reconnectPeriod: 5000,
      }),
    );
    const { clientId } = mqttLibrary.connect.firstCall.args[1];
    expect(clientId).to.match(/^gladys-main-instance-frigate-\d+$/);
    assert.notCalled(gladys.event.emit);
  });

  it('should receive mqtt connect message', async () => {
    frigateManager.mqttRunning = true;

    await frigateManager.connect(configuration);
    frigateManager.mqttClient.emit('connect');

    expect(frigateManager.gladysConnected).to.equal(true);
    assert.calledOnce(gladys.event.emit);
    assert.calledOnceWithExactly(mqttClient.subscribe, 'frigate/#');
  });

  it('should receive mqtt error message', async () => {
    frigateManager.mqttRunning = true;
    frigateManager.gladysConnected = true;
    frigateManager.frigateConnected = true;

    await frigateManager.connect(configuration);
    frigateManager.mqttClient.emit('error', new Error('mqtt_error'));

    expect(frigateManager.gladysConnected).to.equal(false);
    expect(frigateManager.frigateConnected).to.equal(false);
    assert.calledOnce(gladys.event.emit);
  });

  it('should receive mqtt offline message', async () => {
    frigateManager.mqttRunning = true;
    frigateManager.gladysConnected = true;
    frigateManager.frigateConnected = true;

    await frigateManager.connect(configuration);
    frigateManager.mqttClient.emit('offline');

    expect(frigateManager.gladysConnected).to.equal(false);
    expect(frigateManager.frigateConnected).to.equal(false);
    assert.calledOnce(gladys.event.emit);
  });

  it('should receive mqtt normal message', async () => {
    frigateManager.mqttRunning = true;
    frigateManager.handleMqttMessage = fake.returns(true);

    await frigateManager.connect(configuration);
    frigateManager.mqttClient.emit('message', 'topic', 'message');

    assert.calledOnceWithExactly(frigateManager.handleMqttMessage, 'topic', 'message');
  });
});
