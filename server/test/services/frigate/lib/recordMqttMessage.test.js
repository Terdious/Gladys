const { expect } = require('chai');

const FrigateManager = require('../../../../services/frigate/lib');

const serviceId = 'f87b7af2-ca8e-44fc-b754-444354b42fee';

describe('frigate recordMqttMessage', () => {
  let frigateManager;

  beforeEach(() => {
    frigateManager = new FrigateManager({}, null, serviceId);
  });

  it('should record a message with the most recent first', () => {
    frigateManager.recordMqttMessage('frigate/available', 'online');
    frigateManager.recordMqttMessage('frigate/cam/person', '1');

    expect(frigateManager.mqttDebugMessages).to.have.lengthOf(2);
    expect(frigateManager.mqttDebugMessages[0].topic).to.equal('frigate/cam/person');
    expect(frigateManager.mqttDebugMessages[0].payload).to.equal('1');
    expect(frigateManager.mqttDebugMessages[0].received_at).to.be.a('string');
    expect(frigateManager.mqttDebugMessages[1].topic).to.equal('frigate/available');
  });

  it('should replace binary snapshots with a marker', () => {
    frigateManager.recordMqttMessage('frigate/cam/person/snapshot', 'binary-jpeg-data');

    expect(frigateManager.mqttDebugMessages[0].payload).to.equal('[binary snapshot, 16 bytes]');
  });

  it('should truncate long payloads', () => {
    const longPayload = 'a'.repeat(3000);

    frigateManager.recordMqttMessage('frigate/stats', longPayload);

    const { payload } = frigateManager.mqttDebugMessages[0];
    expect(payload).to.have.lengthOf.below(2100);
    expect(payload).to.contain('[truncated, 3000 characters]');
  });

  it('should evict the oldest message when the buffer is full', () => {
    for (let i = 0; i < 205; i += 1) {
      frigateManager.recordMqttMessage(`frigate/topic-${i}`, 'payload');
    }

    expect(frigateManager.mqttDebugMessages).to.have.lengthOf(200);
    expect(frigateManager.mqttDebugMessages[0].topic).to.equal('frigate/topic-204');
    expect(frigateManager.mqttDebugMessages[199].topic).to.equal('frigate/topic-5');
  });
});
