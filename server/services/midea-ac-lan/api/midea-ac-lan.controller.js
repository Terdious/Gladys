const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');
const { transformDevice } = require('../lib/midea-ac-lan.transformDevice');

module.exports = function MideaAcLanController(mideaHandler) {
  async function discover(req, res) {
    const devices = await mideaHandler.discover(req.query || {});
    res.json(devices);
  }

  async function saveDevice(req, res) {
    const device = await mideaHandler.saveDevice(req.body || {});
    res.json(device);
  }

  async function listDevices(req, res) {
    const list = await mideaHandler.listDevices();
    res.json(list);
  }

  async function connect(req, res) {
    const result = await mideaHandler.connectCloud(req.body || {});
    res.json(result);
  }

  async function status(req, res) {
    const result = await mideaHandler.cloudStatus();
    res.json(result);
  }

  async function scanHosts(req, res) {
    const { subnet, port } = req.query || {};
    const list = await mideaHandler.scanHosts({ subnet, port: Number(port) || 6444 });
    res.json(list);
  }

  async function confirm(req, res) {
    const { id, udpId, host, rawUdpResponse } = req.body || {};
    const result = await mideaHandler.confirmDevice({ id, udpId, host, rawUdpResponse });
    res.json(result);
  }

  async function getVariable(req, res) {
    const { name } = req.params || {};
    try {
      const value = await mideaHandler.gladys.variable.getValue(name, mideaHandler.serviceId);
      res.json({ value });
    } catch (e) {
      res.json({ value: '' });
    }
  }

  async function setVariable(req, res) {
    const { name } = req.params || {};
    const { value } = req.body || {};
    await mideaHandler.gladys.variable.setValue(name, value, mideaHandler.serviceId);
    res.json({ value });
  }

  async function clearCache(req, res) {
    const result = await mideaHandler.clearCloudCache();
    res.json(result);
  }

  async function transformDeviceToGladys(req, res) {
    const device = req.body || {};
    const gladysDevice = transformDevice(device, mideaHandler.serviceId);
    res.json(gladysDevice);
  }

  return {
    'get /api/v1/service/midea-ac-lan/discover': {
      authenticated: true,
      controller: asyncMiddleware(discover),
    },
    'get /api/v1/service/midea-ac-lan/devices': {
      authenticated: true,
      controller: asyncMiddleware(listDevices),
    },
    'post /api/v1/service/midea-ac-lan/connect': {
      authenticated: true,
      controller: asyncMiddleware(connect),
    },
    'get /api/v1/service/midea-ac-lan/status': {
      authenticated: true,
      controller: asyncMiddleware(status),
    },
    'get /api/v1/service/midea-ac-lan/scan-hosts': {
      authenticated: true,
      controller: asyncMiddleware(scanHosts),
    },
    'get /api/v1/service/midea-ac-lan/variable/:name': {
      authenticated: true,
      controller: asyncMiddleware(getVariable),
    },
    'post /api/v1/service/midea-ac-lan/variable/:name': {
      authenticated: true,
      controller: asyncMiddleware(setVariable),
    },
    'post /api/v1/service/midea-ac-lan/clear-cache': {
      authenticated: true,
      controller: asyncMiddleware(clearCache),
    },
    'post /api/v1/service/midea-ac-lan/confirm': {
      authenticated: true,
      controller: asyncMiddleware(confirm),
    },
    'post /api/v1/service/midea-ac-lan/transform-device': {
      authenticated: true,
      controller: asyncMiddleware(transformDeviceToGladys),
    },
  };
};
