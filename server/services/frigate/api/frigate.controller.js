const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');
const logger = require('../../../utils/logger');

module.exports = function FrigateController(gladys, frigateManager) {
  /**
   * @api {get} /api/v1/service/frigate/status Get Frigate connection status
   * @apiName status
   * @apiGroup Frigate
   */
  async function status(req, res) {
    logger.debug('Get Frigate status');
    const response = frigateManager.status();
    res.json(response);
  }

  /**
   * @api {get} /api/v1/service/frigate/stats Get last Frigate stats
   * @apiName stats
   * @apiGroup Frigate
   */
  async function stats(req, res) {
    logger.debug('Get Frigate stats');
    res.json(frigateManager.stats);
  }

  /**
   * @api {post} /api/v1/service/frigate/connect Enable integration and install containers
   * @apiName connect
   * @apiGroup Frigate
   */
  async function connect(req, res) {
    logger.debug('Entering Frigate connect step');
    await frigateManager.setEnabled(true);
    await frigateManager.init();
    res.json({
      success: true,
    });
  }

  /**
   * @api {post} /api/v1/service/frigate/disconnect Disable integration and remove containers
   * @apiName disconnect
   * @apiGroup Frigate
   */
  async function disconnect(req, res) {
    logger.debug('Entering Frigate disconnect step');
    await frigateManager.setEnabled(false);
    await frigateManager.disconnect();
    res.json({
      success: true,
    });
  }

  return {
    'get /api/v1/service/frigate/status': {
      authenticated: true,
      controller: asyncMiddleware(status),
    },
    'get /api/v1/service/frigate/stats': {
      authenticated: true,
      controller: asyncMiddleware(stats),
    },
    'post /api/v1/service/frigate/connect': {
      authenticated: true,
      admin: true,
      controller: asyncMiddleware(connect),
    },
    'post /api/v1/service/frigate/disconnect': {
      authenticated: true,
      admin: true,
      controller: asyncMiddleware(disconnect),
    },
  };
};
