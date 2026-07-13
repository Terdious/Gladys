const EventEmitter = require('events');
const { expect, assert } = require('chai');
const Device = require('../../../../lib/device');
const StateManager = require('../../../../lib/state');
const Job = require('../../../../lib/job');

const RANDOM_IMAGE =
  'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';

const event = new EventEmitter();
const job = new Job(event);

describe('Camera.getImage', () => {
  it('should return camera image', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_changed: new Date().toISOString(),
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    const cameraImage = await deviceManager.camera.getImage('test-camera');
    expect(cameraImage).to.equal(RANDOM_IMAGE);
  });
  it('should return the image of a specific image feature', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    const PERSON_IMAGE = 'image/png;base64,person';
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_changed: new Date().toISOString(),
          last_value_string: RANDOM_IMAGE,
        },
        {
          id: '10f2f4a2-06d9-4237-b1f1-9c7a582b0060',
          selector: 'test-camera-person-image',
          category: 'camera',
          type: 'image',
          last_value_changed: new Date().toISOString(),
          last_value_string: PERSON_IMAGE,
        },
      ],
    });
    const cameraImage = await deviceManager.camera.getImage('test-camera', 'test-camera-person-image');
    expect(cameraImage).to.equal(PERSON_IMAGE);
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
          last_value_changed: new Date().toISOString(),
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    const promise = deviceManager.camera.getImage('test-camera', 'unknown-feature');
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
    const promise = deviceManager.camera.getImage('camera-not-found');
    return assert.isRejected(promise, 'Camera not found');
  });
  it('should return camera image is too old (old date)', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_changed: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    const promise = deviceManager.camera.getImage('test-camera');
    return assert.isRejected(promise, 'Camera image is too old');
  });
  it('should return camera image is too old (null date)', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_changed: null,
          last_value_string: null,
        },
      ],
    });
    const promise = deviceManager.camera.getImage('test-camera');
    return assert.isRejected(promise, 'Camera image is too old');
  });
  it('should return camera image is too old (wrong date)', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          category: 'camera',
          type: 'image',
          last_value_changed: 'lalala',
          last_value_string: null,
        },
      ],
    });
    const promise = deviceManager.camera.getImage('test-camera');
    return assert.isRejected(promise, 'Camera image is too old');
  });
  it('should return camera not found', async () => {
    const stateManager = new StateManager(event);
    const deviceManager = new Device(event, {}, stateManager, {}, {}, {}, job);
    stateManager.setState('device', 'test-camera-2', {
      features: [
        {
          id: '565d05fc-1736-4b76-99ca-581232901d96',
          selector: 'test-camera',
          last_value_string: RANDOM_IMAGE,
        },
      ],
    });
    const promise = deviceManager.camera.getImage('test-camera-2');
    return assert.isRejected(promise, 'Camera image feature not found');
  });
});
