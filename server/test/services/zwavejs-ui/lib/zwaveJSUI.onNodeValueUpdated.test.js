const sinon = require('sinon');

const { assert, fake } = sinon;

const ZwaveJSUIHandler = require('../../../../services/zwavejs-ui/lib');
const { STATE, BUTTON_STATUS } = require('../../../../utils/constants');

const serviceId = 'ffa13430-df93-488a-9733-5c540e9558e0';

const gladys = {
  variable: {
    getValue: fake.resolves('toto'),
  },
  event: {
    emit: fake.returns(null),
  },
};

describe('zwaveJSUIHandler.onNodeValueUpdated', () => {
  beforeEach(() => {
    sinon.reset();
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should not fail on unknown Gladys device', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [
          {
            external_id: 'zwavejs-ui:2:0:notification:access_control:door_state_simple',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 4 },
        {
          commandClassName: 'Notification',
          commandClass: 113,
          property: 'Access Control',
          endpoint: 0,
          newValue: 22,
          prevValue: 23,
          propertyName: 'Access Control',
          propertyKey: 'Door state (simple)',
        },
      ],
    });
  });

  it('should not fail on unknown zWave device', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [
          {
            external_id: 'zwavejs-ui:2:0:notification:access_control:door_state_simple',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Notification',
          commandClass: 113,
          property: 'Access Control',
          endpoint: 0,
          newValue: 22,
          prevValue: 23,
          propertyName: 'Access Control',
          propertyKey: 'Door state (simple)',
        },
      ],
    });
  });

  it('should not fail on unknown state updated', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Notification',
          commandClass: 1150,
          property: 'Unexisting',
          endpoint: 0,
          newValue: 22,
          prevValue: 23,
          propertyName: 'Unexisting',
        },
      ],
    });
  });

  it('should not fail on unknown feature on device', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Notification',
          commandClass: 113,
          property: 'Access Control',
          endpoint: 0,
          newValue: 22,
          prevValue: 23,
          propertyName: 'Access Control',
          propertyKey: 'Door state (simple)',
          propertyKeyName: 'Door state (simple)',
        },
      ],
    });
  });

  it('should save a new open value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [
          {
            external_id: 'zwavejs-ui:2:0:notification:access_control:door_state_simple',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Notification',
          commandClass: 113,
          property: 'Access Control',
          endpoint: 0,
          newValue: 22,
          prevValue: 23,
          propertyName: 'Access Control',
          propertyKey: 'Door state (simple)',
          propertyKeyName: 'Door state (simple)',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:2:0:notification:access_control:door_state_simple',
      state: 0,
    });
  });

  it('should save a new closed value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [
          {
            external_id: 'zwavejs-ui:2:0:notification:access_control:door_state_simple',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Notification',
          commandClass: 113,
          property: 'Access Control',
          endpoint: 0,
          newValue: 23,
          prevValue: 22,
          propertyName: 'Access Control',
          propertyKey: 'Door state (simple)',
          propertyKeyName: 'Door state (simple)',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:2:0:notification:access_control:door_state_simple',
      state: 1,
    });
  });

  it('should not fail on unsupported door value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [
          {
            external_id: 'zwavejs-ui:2:0:notification:access_control:door_state_simple',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Notification',
          commandClass: 113,
          property: 'Access Control',
          endpoint: 0,
          newValue: 45,
          prevValue: 22,
          propertyName: 'Access Control',
          propertyKey: 'Door state (simple)',
          propertyKeyName: 'Door state (simple)',
        },
      ],
    });
    assert.notCalled(gladys.event.emit);
  });

  it('should save a new true binary sensor value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_sensor:any',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Sensor',
          commandClass: 48,
          property: 'any',
          endpoint: 0,
          newValue: true,
          prevValue: false,
          propertyName: 'any',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:3:0:binary_sensor:any',
      state: STATE.ON,
    });
  });

  it('should save a new false binary value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_sensor:any',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Sensor',
          commandClass: 48,
          property: 'any',
          endpoint: 0,
          newValue: false,
          prevValue: true,
          propertyName: 'any',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:3:0:binary_sensor:any',
      state: STATE.OFF,
    });
  });

  it('should not fail on unsupported binary sensor value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_sensor:any',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Sensor',
          commandClass: 48,
          property: 'any',
          endpoint: 0,
          newValue: -1,
          prevValue: true,
          propertyName: 'any',
        },
      ],
    });
    assert.notCalled(gladys.event.emit);
  });

  it('should save a new true binary sensor general purpose value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_sensor:general_purpose',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Sensor',
          commandClass: 48,
          property: 'General Purpose',
          endpoint: 0,
          newValue: true,
          prevValue: false,
          propertyName: 'General Purpose',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:3:0:binary_sensor:general_purpose',
      state: STATE.ON,
    });
  });

  it('should save a new false binary general purpose value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_sensor:general_purpose',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Sensor',
          commandClass: 48,
          property: 'General Purpose',
          endpoint: 0,
          newValue: false,
          prevValue: true,
          propertyName: 'General Purpose',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:3:0:binary_sensor:general_purpose',
      state: STATE.OFF,
    });
  });

  it('should not fail on unsupported binary sensor general purpose value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_sensor:general_purpose',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Sensor',
          commandClass: 48,
          property: 'General Purpose',
          endpoint: 0,
          newValue: -1,
          prevValue: true,
          propertyName: 'General Purpose',
        },
      ],
    });
    assert.notCalled(gladys.event.emit);
  });

  it('should save a new true binary switch value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_switch:currentvalue',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Switch',
          commandClass: 37,
          property: 'currentValue',
          endpoint: 0,
          newValue: true,
          prevValue: false,
          propertyName: 'currentValue',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:3:0:binary_switch:currentvalue',
      state: 1,
    });
  });

  it('should save a new false binary value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_switch:currentvalue',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Switch',
          commandClass: 37,
          property: 'currentValue',
          endpoint: 0,
          newValue: false,
          prevValue: true,
          propertyName: 'currentValue',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:3:0:binary_switch:currentvalue',
      state: 0,
    });
  });

  it('should not fail on unsupported binary switch value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:3',
        features: [
          {
            external_id: 'zwavejs-ui:3:0:binary_switch:currentvalue',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 3,
        deviceClass: {
          basic: 4,
          generic: 16,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 3 },
        {
          commandClassName: 'Binary Switch',
          commandClass: 37,
          property: 'currentValue',
          endpoint: 0,
          newValue: -1,
          prevValue: true,
          propertyName: 'currentValue',
        },
      ],
    });
    assert.notCalled(gladys.event.emit);
  });

  it('should save a new air temperature value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [
          {
            external_id: 'zwavejs-ui:2:0:multilevel_sensor:air_temperature',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Multilevel Sensor',
          commandClass: 49,
          property: 'Air temperature',
          endpoint: 0,
          newValue: 20.8,
          prevValue: 17.5,
          propertyName: 'Air temperature',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:2:0:multilevel_sensor:air_temperature',
      state: 20.8,
    });
  });

  it('should save a new illuminance value', async () => {
    const NEW_LUMINANCE_VALUE = 120;

    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [
          {
            external_id: 'zwavejs-ui:2:0:multilevel_sensor:illuminance',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Multilevel Sensor',
          commandClass: 49,
          property: 'Illuminance',
          endpoint: 0,
          newValue: NEW_LUMINANCE_VALUE,
          prevValue: 0,
          propertyName: 'Illuminance',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:2:0:multilevel_sensor:illuminance',
      state: NEW_LUMINANCE_VALUE,
    });
  });

  it('should save a new power value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:2',
        features: [
          {
            external_id: 'zwavejs-ui:2:0:multilevel_sensor:power',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 2,
        deviceClass: {
          basic: 4,
          generic: 7,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 2 },
        {
          commandClassName: 'Multilevel Sensor',
          commandClass: 49,
          property: 'Power',
          endpoint: 0,
          newValue: 1.7,
          prevValue: 0,
          propertyName: 'Power',
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:2:0:multilevel_sensor:power',
      state: 1.7,
    });
  });

  it('should save a new multilevel switch value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:6',
        features: [
          {
            category: 'switch',
            command_class: 38,
            command_class_name: 'Multilevel Switch',
            command_class_version: 4,
            endpoint: 0,
            external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:state',
            feature_name: 'state',
            has_feedback: false,
            keep_history: true,
            max: 1,
            min: 0,
            name: '6-38-0-currentValue:state',
            node_id: 6,
            property_key_name: undefined,
            property_name: 'currentValue',
            read_only: false,
            selector: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:state',
            type: 'binary',
          },
          {
            category: 'switch',
            command_class: 38,
            command_class_name: 'Multilevel Switch',
            command_class_version: 4,
            endpoint: 0,
            external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
            feature_name: 'position',
            has_feedback: false,
            keep_history: true,
            max: 99,
            min: 0,
            name: '6-38-0-currentValue:position',
            node_id: 6,
            property_key_name: undefined,
            property_name: 'currentValue',
            read_only: false,
            selector: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
            type: 'dimmer',
            unit: 'percent',
          },
          {
            category: 'switch',
            command_class: 38,
            command_class_name: 'Multilevel Switch',
            command_class_version: 4,
            endpoint: 0,
            external_id: 'zwavejs-ui:6:0:multilevel_switch:restoreprevious',
            feature_name: '',
            has_feedback: false,
            keep_history: true,
            max: 1,
            min: 0,
            name: '6-38-0-restorePrevious',
            node_id: 6,
            property_key_name: undefined,
            property_name: 'restorePrevious',
            read_only: false,
            selector: 'zwavejs-ui:6:0:multilevel_switch:restoreprevious',
            type: 'binary',
          },
        ],
        name: 'inter-01',
        service_id: 'ffa13430-df93-488a-9733-5c540e9558e0',
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 6,
        deviceClass: {
          basic: 4,
          generic: 17,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 6 },
        {
          commandClassName: 'Multilevel Switch',
          commandClass: 38,
          property: 'currentValue',
          endpoint: 0,
          newValue: 45,
          prevValue: 0,
          propertyName: 'currentvalue',
        },
      ],
    });

    gladys.event.emit.firstCall.calledWith('device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
      state: 45,
    });

    gladys.event.emit.secondCall.calledWith('device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:state',
      state: STATE.ON,
    });

    gladys.event.emit.thirdCall.calledWith('device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:multilevel_switch:restoreprevious',
      state: STATE.ON,
    });
  });

  it('should turn off state on a new multilevel switch value of 0', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:6',
        features: [
          {
            category: 'switch',
            command_class: 38,
            command_class_name: 'Multilevel Switch',
            command_class_version: 4,
            endpoint: 0,
            external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:state',
            feature_name: 'state',
            has_feedback: false,
            keep_history: true,
            max: 1,
            min: 0,
            name: '6-38-0-currentValue:state',
            node_id: 6,
            property_key_name: undefined,
            property_name: 'currentValue',
            read_only: false,
            selector: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:state',
            type: 'binary',
          },
          {
            category: 'switch',
            command_class: 38,
            command_class_name: 'Multilevel Switch',
            command_class_version: 4,
            endpoint: 0,
            external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
            feature_name: 'position',
            has_feedback: false,
            keep_history: true,
            max: 99,
            min: 0,
            name: '6-38-0-currentValue:position',
            node_id: 6,
            property_key_name: undefined,
            property_name: 'currentValue',
            read_only: false,
            selector: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
            type: 'dimmer',
            unit: 'percent',
          },
        ],
        name: 'inter-01',
        service_id: 'ffa13430-df93-488a-9733-5c540e9558e0',
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 6,
        deviceClass: {
          basic: 4,
          generic: 17,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 6 },
        {
          commandClassName: 'Multilevel Switch',
          commandClass: 38,
          property: 'currentValue',
          endpoint: 0,
          newValue: 0,
          prevValue: 99,
          propertyName: 'currentvalue',
        },
      ],
    });

    gladys.event.emit.firstCall.calledWith('device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
      state: 0,
    });

    gladys.event.emit.secondCall.calledWith('device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:state',
      state: STATE.OFF,
    });
  });

  it('should save a new curtain multilevel switch value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:6',
        features: [
          {
            category: 'switch',
            command_class: 38,
            command_class_name: 'Multilevel Switch',
            command_class_version: 4,
            endpoint: 0,
            external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:state',
            feature_name: 'state',
            has_feedback: false,
            keep_history: true,
            max: 1,
            min: 0,
            name: '6-38-0-currentValue:state',
            node_id: 6,
            property_key_name: undefined,
            property_name: 'currentValue',
            read_only: false,
            selector: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:state',
            type: 'binary',
          },
          {
            category: 'switch',
            command_class: 38,
            command_class_name: 'Multilevel Switch',
            command_class_version: 4,
            endpoint: 0,
            external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
            feature_name: 'position',
            has_feedback: false,
            keep_history: true,
            max: 99,
            min: 0,
            name: '6-38-0-currentValue:position',
            node_id: 6,
            property_key_name: undefined,
            property_name: 'currentValue',
            read_only: false,
            selector: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
            type: 'dimmer',
            unit: 'percent',
          },
        ],
        name: 'curtain-01',
        service_id: 'ffa13430-df93-488a-9733-5c540e9558e0',
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 6,
        deviceClass: {
          basic: 4,
          generic: 17,
          specific: 6,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 6 },
        {
          commandClassName: 'Multilevel Switch',
          commandClass: 38,
          property: 'currentValue',
          endpoint: 0,
          newValue: 45,
          prevValue: 0,
          propertyName: 'currentvalue',
        },
      ],
    });

    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:multilevel_switch:currentvalue:position',
      state: 45,
    });
  });

  it('should handle a click scene controller value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Central Scene',
          commandClass: 91,
          property: 'scene',
          propertyKey: '001',
          value: 0,
          propertyName: 'scene',
          propertyKeyName: '001',
          newValue: 0,
          stateless: true,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
      state: BUTTON_STATUS.CLICK,
    });
  });
  it('should handle a released button scene controller value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Central Scene',
          commandClass: 91,
          property: 'scene',
          propertyKey: '001',
          value: 1,
          propertyName: 'scene',
          propertyKeyName: '001',
          newValue: 1,
          stateless: true,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
      state: BUTTON_STATUS.RELEASE,
    });
  });
  it('should handle a hold button scene controller value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Central Scene',
          commandClass: 91,
          property: 'scene',
          propertyKey: '001',
          value: 2,
          propertyName: 'scene',
          propertyKeyName: '001',
          newValue: 2,
          stateless: true,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
      state: BUTTON_STATUS.HOLD_CLICK,
    });
  });
  it('should handle a double click scene controller value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Central Scene',
          commandClass: 91,
          property: 'scene',
          propertyKey: '001',
          value: 3,
          propertyName: 'scene',
          propertyKeyName: '001',
          newValue: 3,
          stateless: true,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
      state: BUTTON_STATUS.DOUBLE_CLICK,
    });
  });
  it('should handle a triple click scene controller value', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Central Scene',
          commandClass: 91,
          property: 'scene',
          propertyKey: '001',
          value: 4,
          propertyName: 'scene',
          propertyKeyName: '001',
          newValue: 4,
          stateless: true,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
      state: BUTTON_STATUS.TRIPLE,
    });
  });

  it('should not fail on unknown value from scene controller', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:central_scene:scene:001',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Central Scene',
          commandClass: 91,
          property: 'scene',
          propertyKey: '001',
          value: -1,
          propertyName: 'scene',
          propertyKeyName: '001',
          newValue: -1,
          stateless: true,
        },
      ],
    });
    assert.notCalled(gladys.event.emit);
  });

  it('should update battery level on new value received', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    const BATTERY_LEVEL_RECEIVED = 2;
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:battery:level',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Battery',
          commandClass: 128,
          property: 'level',
          propertyName: 'level',
          prevValue: 100,
          newValue: BATTERY_LEVEL_RECEIVED,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:battery:level',
      state: BATTERY_LEVEL_RECEIVED,
    });
  });

  it('should set battery not low on false received', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:battery:islow',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Battery',
          commandClass: 128,
          property: 'isLow',
          propertyName: 'isLow',
          prevValue: true,
          newValue: false,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:battery:islow',
      state: STATE.OFF,
    });
  });

  it('should set battery low on true received', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:battery:islow',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Battery',
          commandClass: 128,
          property: 'isLow',
          propertyName: 'isLow',
          prevValue: false,
          newValue: true,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:battery:islow',
      state: STATE.ON,
    });
  });

  it('should not fail on battery unknown value received', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:battery:islow',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Battery',
          commandClass: 128,
          property: 'isLow',
          propertyName: 'isLow',
          prevValue: 20,
          newValue: -1,
        },
      ],
    });

    assert.notCalled(gladys.event.emit);
  });

  it('should set alarm sensor state off on false received', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:alarm_sensor:state',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Alarm Sensor',
          commandClass: 156,
          property: 'state',
          propertyName: 'state',
          prevValue: true,
          newValue: false,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:alarm_sensor:state',
      state: STATE.OFF,
    });
  });

  it('should set alarm sensor state on on true received', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:13',
        features: [
          {
            external_id: 'zwavejs-ui:13:0:alarm_sensor:state',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 13,
        deviceClass: {
          basic: 4,
          generic: 24,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 13 },
        {
          commandClassName: 'Alarm Sensor',
          commandClass: 156,
          property: 'state',
          propertyName: 'state',
          prevValue: false,
          newValue: true,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:13:0:alarm_sensor:state',
      state: STATE.ON,
    });
  });

  it('should set meter to the value received', async () => {
    const zwaveJSUIHandler = new ZwaveJSUIHandler(gladys, {}, serviceId);
    zwaveJSUIHandler.devices = [
      {
        external_id: 'zwavejs-ui:6',
        features: [
          {
            external_id: 'zwavejs-ui:6:0:meter:value:electric_a_consumed',
          },
          {
            external_id: 'zwavejs-ui:6:0:meter:value:electric_kwh_consumed',
          },
          {
            external_id: 'zwavejs-ui:6:0:meter:value:electric_v_consumed',
          },
          {
            external_id: 'zwavejs-ui:6:0:meter:value:electric_w_consumed',
          },
        ],
      },
    ];
    zwaveJSUIHandler.zwaveJSDevices = [
      {
        id: 6,
        deviceClass: {
          basic: 4,
          generic: 17,
          specific: 1,
        },
      },
    ];

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 6 },
        {
          commandClassName: 'Meter',
          commandClass: 50,
          property: 'value',
          propertyName: 'value',
          propertyKey: 'electric_w_consumed',
          propertyKeyName: 'electric_w_consumed',
          prevValue: 2262.291,
          newValue: 2264.711,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:meter:value:electric_w_consumed',
      state: 2264.711,
    });

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 6 },
        {
          commandClassName: 'Meter',
          commandClass: 50,
          property: 'value',
          propertyName: 'value',
          propertyKey: 'electric_kwh_consumed',
          propertyKeyName: 'electric_kwh_consumed',
          prevValue: 16133.081,
          newValue: 16133.452,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:meter:value:electric_kwh_consumed',
      state: 16133.452,
    });

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 6 },
        {
          commandClassName: 'Meter',
          commandClass: 50,
          property: 'value',
          propertyName: 'value',
          propertyKey: 'electric_v_consumed',
          propertyKeyName: 'electric_v_consumed',
          prevValue: 200,
          newValue: 0,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:meter:value:electric_v_consumed',
      state: 0,
    });

    await zwaveJSUIHandler.onNodeValueUpdated({
      data: [
        { id: 6 },
        {
          commandClassName: 'Meter',
          commandClass: 50,
          property: 'value',
          propertyName: 'value',
          propertyKey: 'electric_a_consumed',
          propertyKeyName: 'electric_a_consumed',
          prevValue: 0,
          newValue: 1,
        },
      ],
    });
    assert.calledWith(gladys.event.emit, 'device.new-state', {
      device_feature_external_id: 'zwavejs-ui:6:0:meter:value:electric_a_consumed',
      state: 1,
    });
  });
});
