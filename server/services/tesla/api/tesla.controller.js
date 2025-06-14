const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');

module.exports = function TeslaController(teslaHandler) {
  /**
 * @api {get} /api/v1/service/tesla/configuration Get Tesla Configuration.
 * @apiName getConfiguration
 * @apiGroup Tesla
 */
  async function getConfiguration(req, res) {
    const configuration = await teslaHandler.getConfiguration();
    res.json(configuration);
  }

  /**
   * @api {get} /api/v1/service/tesla/status Get Tesla Status.
   * @apiName getStatus
   * @apiGroup Tesla
   */
  async function getStatus(req, res) {
    const result = await teslaHandler.getStatus();
    res.json(result);
  }

  /**
   * @api {post} /api/v1/service/tesla/configuration Save Tesla Configuration.
   * @apiName saveConfiguration
   * @apiGroup Tesla
   */
  async function saveConfiguration(req, res) {
    const result = await teslaHandler.saveConfiguration(req.body);
    res.json({
      success: result,
    });
  }

  /**
   * @api {post} /api/v1/service/tesla/status save Tesla connection status
   * @apiName saveStatus
   * @apiGroup Tesla
   */
  async function saveStatus(req, res) {
    const result = await teslaHandler.saveStatus(req.body);
    res.json({
      success: result,
    });
  }

  /**
   * @api {post} /api/v1/service/tesla/connect Connect Tesla
   * @apiName connect
   * @apiGroup Tesla
   */
  async function connect(req, res) {
    await teslaHandler.getConfiguration();
    const result = await teslaHandler.connect();
    res.json(result);
  }

  /**
 * @api {post} /api/v1/service/tesla/token Retrieve access and refresh Tokens tesla with code of return
 * @apiName retrieveTokens
 * @apiGroup Tesla
 */
  async function retrieveTokens(req, res) {
    await teslaHandler.getConfiguration();
    const result = await teslaHandler.retrieveTokens(req.body);
    res.json(result);
  }

  /**
   * @api {post} /api/v1/service/tesla/disconnect Disconnect tesla
   * @apiName disconnect
   * @apiGroup Tesla
   */
  async function disconnect(req, res) {
    await teslaHandler.disconnect();
    res.json({
      success: true,
    });
  }

//   /**
//  * @api {get} /api/v1/service/tesla/discover Discover tesla devices from API.
//  * @apiName discover
//  * @apiGroup Tesla
//  */
//   async function discover(req, res) {
//     let devices;
//     if (!teslaHandler.discoveredDevices || req.query.refresh === 'true') {
//       devices = await teslaHandler.discoverDevices();
//     } else {
//       devices = teslaHandler.discoveredDevices.filter((device) => {
//         const existInGladys = teslaHandler.gladys.stateManager.get('deviceByExternalId', device.external_id);
//         return existInGladys === null;
//       });
//     }
//     res.json(devices);
//   }

//   /**
//    * @description Get all vehicles
//    * @param {Object} req - Express request object
//    * @param {Object} res - Express response object
//    */
//   async function getVehicles(req, res) {
//       try {
//           const vehicles = await teslaHandler.getVehicles();
//           res.json({
//               success: true,
//               vehicles,
//           });
//       } catch (e) {
//           res.status(400).json({
//               success: false,
//               message: e.message,
//           });
//       }
//   }

  return {
    'get /api/v1/service/tesla/configuration': {
      authenticated: true,
      controller: asyncMiddleware(getConfiguration),
    },
    'post /api/v1/service/tesla/configuration': {
      authenticated: true,
      controller: asyncMiddleware(saveConfiguration),
    },
    'get /api/v1/service/tesla/status': {
      authenticated: true,
      controller: asyncMiddleware(getStatus),
    },
    'post /api/v1/service/tesla/status': {
      authenticated: true,
      controller: asyncMiddleware(saveStatus),
    },
    'post /api/v1/service/tesla/connect': {
      authenticated: true,
      controller: asyncMiddleware(connect),
    },
    'post /api/v1/service/tesla/token': {
      authenticated: true,
      controller: asyncMiddleware(retrieveTokens),
    },
    'post /api/v1/service/tesla/disconnect': {
      authenticated: true,
      controller: asyncMiddleware(disconnect),
    },
    // 'get /api/v1/service/tesla/discover': {
    //   authenticated: true,
    //   controller: asyncMiddleware(discover),
    // },
    // 'get /api/v1/service/tesla/getVehicles': {
    //   authenticated: true,
    //   controller: asyncMiddleware(getVehicles),
    // },
  };
}; 