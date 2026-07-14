const fs = require('fs');
const path = require('path');

const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');
const logger = require('../../../utils/logger');
const { Error404, Error400 } = require('../../../utils/httpErrors');
const { validateFilename, validateSessionId } = require('../utils/validateStreamParams');

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

  /**
   * @api {get} /api/v1/service/frigate/config/retention Get effective recording retention
   * @apiName getRetention
   * @apiGroup Frigate
   */
  async function getRetention(req, res) {
    logger.debug('Get Frigate effective retention');
    const retention = await frigateManager.getRetentionSettings();
    res.json(retention);
  }

  /**
   * @api {post} /api/v1/service/frigate/config/apply Regenerate Frigate config from Gladys devices
   * @apiName applyConfig
   * @apiGroup Frigate
   */
  async function applyConfig(req, res) {
    logger.debug('Applying Frigate configuration');
    await frigateManager.init();
    res.json({
      success: true,
    });
  }

  /**
   * @api {get} /api/v1/service/frigate/mqtt/debug Get last received MQTT messages
   * @apiName getMqttDebugMessages
   * @apiGroup Frigate
   */
  async function getMqttDebugMessages(req, res) {
    res.json(frigateManager.mqttDebugMessages);
  }

  /**
   * @api {post} /api/v1/service/frigate/camera/:camera_selector/ptz Send a PTZ command
   * @apiName sendPtzCommand
   * @apiGroup Frigate
   */
  async function sendPtzCommand(req, res) {
    await frigateManager.sendPtzCommand(req.params.camera_selector, req.body.command);
    res.json({ success: true });
  }

  /**
   * @api {post} /api/v1/service/frigate/camera/:camera_selector/streaming/start Start streaming
   * @apiName startStreaming
   * @apiGroup Frigate
   */
  async function startStreaming(req, res) {
    const response = await frigateManager.startStreamingIfNotStarted(
      req.params.camera_selector,
      req.body.is_gladys_gateway,
      req.body.segment_duration,
    );
    res.send(response);
  }

  /**
   * @api {post} /api/v1/service/frigate/camera/:camera_selector/streaming/stop Stop streaming
   * @apiName stopStreaming
   * @apiGroup Frigate
   */
  async function stopStreaming(req, res) {
    await frigateManager.stopStreaming(req.params.camera_selector);
    res.send({ success: true });
  }

  /**
   * @api {post} /api/v1/service/frigate/camera/:camera_selector/streaming/ping Live still active ping
   * @apiName streamingPing
   * @apiGroup Frigate
   */
  async function streamingPing(req, res) {
    await frigateManager.liveActivePing(req.params.camera_selector);
    res.send({ success: true });
  }

  /**
   * @api {get} /api/v1/service/frigate/camera/streaming/:folder/:file Get streaming file
   * @apiName getStreamingFile
   * @apiGroup Frigate
   */
  async function getStreamingFile(req, res) {
    try {
      validateSessionId(req.params.folder);
      validateFilename(req.params.file);
      const filePath = path.join(gladys.config.tempFolder, req.params.folder, req.params.file);
      const filestream = fs.createReadStream(filePath);
      filestream.on('error', (err) => {
        res.status(404).end();
      });
      filestream.pipe(res);
    } catch (e) {
      if (e instanceof Error400) {
        throw e;
      }
      logger.warn(e);
      throw new Error404('FILE_NOT_FOUND');
    }
  }

  /**
   * @api {post} /api/v1/service/frigate/config/save Regenerate Frigate config file without restart
   * @apiName saveConfig
   * @apiGroup Frigate
   */
  async function saveConfig(req, res) {
    logger.debug('Saving Frigate configuration without restart');
    const response = await frigateManager.writeConfig();
    res.json(response);
  }

  /**
   * @api {post} /api/v1/service/frigate/config/restart Restart Frigate to reload pending config
   * @apiName restartFrigate
   * @apiGroup Frigate
   */
  async function restartFrigate(req, res) {
    logger.debug('Restarting Frigate');
    await frigateManager.restartFrigate();
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
    'get /api/v1/service/frigate/config/retention': {
      authenticated: true,
      controller: asyncMiddleware(getRetention),
    },
    'post /api/v1/service/frigate/config/apply': {
      authenticated: true,
      controller: asyncMiddleware(applyConfig),
    },
    'get /api/v1/service/frigate/mqtt/debug': {
      authenticated: true,
      admin: true,
      controller: asyncMiddleware(getMqttDebugMessages),
    },
    'post /api/v1/service/frigate/camera/:camera_selector/ptz': {
      authenticated: true,
      admin: false,
      controller: asyncMiddleware(sendPtzCommand),
    },
    'post /api/v1/service/frigate/camera/:camera_selector/streaming/start': {
      authenticated: true,
      admin: false,
      controller: asyncMiddleware(startStreaming),
    },
    'post /api/v1/service/frigate/camera/:camera_selector/streaming/stop': {
      authenticated: true,
      admin: false,
      controller: asyncMiddleware(stopStreaming),
    },
    'post /api/v1/service/frigate/camera/:camera_selector/streaming/ping': {
      authenticated: true,
      admin: false,
      controller: asyncMiddleware(streamingPing),
    },
    'get /api/v1/service/frigate/camera/streaming/:folder/:file': {
      authenticated: true,
      admin: false,
      controller: asyncMiddleware(getStreamingFile),
    },
    'post /api/v1/service/frigate/config/save': {
      authenticated: true,
      controller: asyncMiddleware(saveConfig),
    },
    'post /api/v1/service/frigate/config/restart': {
      authenticated: true,
      controller: asyncMiddleware(restartFrigate),
    },
  };
};
