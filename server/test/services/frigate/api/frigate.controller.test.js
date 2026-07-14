const sinon = require('sinon');

const { assert, fake } = sinon;
const FrigateController = require('../../../../services/frigate/api/frigate.controller');

const gladys = {
  event: {
    emit: fake.resolves(null),
  },
};

const frigateManager = {
  status: fake.returns({ frigateEnabled: true }),
  stats: { service: { version: '0.17.2' } },
  setEnabled: fake.resolves(null),
  init: fake.resolves(null),
  disconnect: fake.resolves(null),
  writeConfig: fake.resolves({ configChanged: true, configPendingRestart: true }),
  restartFrigate: fake.resolves(null),
};

describe('frigate API', () => {
  let controller;

  beforeEach(() => {
    controller = FrigateController(gladys, frigateManager);
    sinon.reset();
  });

  it('get /api/v1/service/frigate/status', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['get /api/v1/service/frigate/status'].controller(req, res);

    assert.calledOnce(frigateManager.status);
    assert.calledWith(res.json, { frigateEnabled: true });
  });

  it('get /api/v1/service/frigate/stats', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['get /api/v1/service/frigate/stats'].controller(req, res);

    assert.calledWith(res.json, frigateManager.stats);
  });

  it('post /api/v1/service/frigate/connect', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/connect'].controller(req, res);

    assert.calledOnceWithExactly(frigateManager.setEnabled, true);
    assert.calledOnce(frigateManager.init);
    assert.calledWith(res.json, { success: true });
  });

  it('post /api/v1/service/frigate/disconnect', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/disconnect'].controller(req, res);

    assert.calledOnceWithExactly(frigateManager.setEnabled, false);
    assert.calledOnce(frigateManager.disconnect);
    assert.calledWith(res.json, { success: true });
  });

  it('post /api/v1/service/frigate/config/apply', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/config/apply'].controller(req, res);

    assert.calledOnce(frigateManager.init);
    assert.calledWith(res.json, { success: true });
  });

  it('post /api/v1/service/frigate/config/save', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/config/save'].controller(req, res);

    assert.calledOnce(frigateManager.writeConfig);
    assert.calledWith(res.json, { configChanged: true, configPendingRestart: true });
  });

  it('post /api/v1/service/frigate/config/restart', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/frigate/config/restart'].controller(req, res);

    assert.calledOnce(frigateManager.restartFrigate);
    assert.calledWith(res.json, { success: true });
  });
});
