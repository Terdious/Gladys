const EventEmitter = require('events');
const { expect, assert } = require('chai');
const Device = require('../../../../lib/device');
const StateManager = require('../../../../lib/state');
const Job = require('../../../../lib/job');

const RANDOM_IMAGE =
  'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';

const event = new EventEmitter();
const job = new Job(event);

describe('Camera.setImage', () => {
  it('should set image', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    await deviceManager.camera.setImage('test-camera', RANDOM_IMAGE);
    const newDeviceFeature = stateManager.get('deviceFeature', 'test-camera');
    expect(newDeviceFeature).to.have.property('last_value_string', RANDOM_IMAGE);
  });
  it('should set image on a specific image feature', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_string: RANDOM_IMAGE,
        },
        {
          id: '10f2f4a2-06d9-4237-b1f1-9c7a582b0060',
          selector: 'test-camera-person-image',
          category: 'camera',
          type: 'image',
          last_value_string: null,
        },
      ],
    });
    await deviceManager.camera.setImage('test-camera', RANDOM_IMAGE, 'test-camera-person-image');
    const targetedFeature = stateManager.get('deviceFeature', 'test-camera-person-image');
    expect(targetedFeature).to.have.property('last_value_string', RANDOM_IMAGE);
  });
  it('should return camera image feature not found with an unknown feature selector', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    const promise = deviceManager.camera.setImage('test-camera', RANDOM_IMAGE, 'unknown-feature');
    return assert.isRejected(promise, 'Camera image feature not found');
  });
  it('should return camera not found', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    const promise = deviceManager.camera.setImage('not-found-camera', RANDOM_IMAGE);
    return assert.isRejected(promise, 'Camera not found');
  });
  it('should return camera feature not found', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    const promise = deviceManager.camera.setImage('test-camera', RANDOM_IMAGE);
    return assert.isRejected(promise, 'Camera image feature not found');
  });
  it('should return image too big', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    let bigImage = 'image/png;base64,';
    while (bigImage.length < 151 * 1024) {
      bigImage += 'lkmlklkmlklsjfksdjflkdsjkj';
    }
    const promise = deviceManager.camera.setImage('test-camera', bigImage);
    return assert.isRejected(promise, 'Image is too big');
  });
});
