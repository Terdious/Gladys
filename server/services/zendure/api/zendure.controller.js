const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');
const { BadParameters } = require('../../../utils/coreErrors');

module.exports = function ZendureController(zendureManager) {
  /**
   * @api {post} /api/v1/service/zendure/connect Connect Zendure cloud account.
   * @apiName connect
   * @apiGroup Zendure
   */
  async function connect(req, res) {
    const configuration = await zendureManager.getConfiguration();
    try {
      await zendureManager.connect(configuration);
    } catch (e) {
      if (e instanceof BadParameters) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: e.message,
        });
        return;
      }
      throw e;
    }
    res.json({
      success: true,
    });
  }

  /**
   * @api {get} /api/v1/service/zendure/status Get Zendure status.
   * @apiName status
   * @apiGroup Zendure
   */
  async function status(req, res) {
    const result = await zendureManager.getStatus();
    res.json(result);
  }

  /**
   * @api {get} /api/v1/service/zendure/discover Retrieve Zendure devices from cloud.
   * @apiName discover
   * @apiGroup Zendure
   */
  async function discover(req, res) {
    const devices = await zendureManager.discoverDevices();
    res.json(devices);
  }

  return {
    'post /api/v1/service/zendure/connect': {
      authenticated: true,
      controller: asyncMiddleware(connect),
    },
    'get /api/v1/service/zendure/status': {
      authenticated: true,
      controller: asyncMiddleware(status),
    },
    'get /api/v1/service/zendure/discover': {
      authenticated: true,
      controller: asyncMiddleware(discover),
    },
  };
};
