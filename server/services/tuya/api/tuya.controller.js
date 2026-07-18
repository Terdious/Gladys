const asyncMiddleware = require('../../../api/middlewares/asyncMiddleware');
const logger = require('../../../utils/logger');
const { updateDiscoveredDeviceAfterLocalPoll } = require('../lib/tuya.localPoll');
const { getKnownLocalDps } = require('../lib/device/tuya.localMapping');
const { buildLocalScanResponse } = require('../lib/tuya.localScan');
const { getAllDegraded, getLocalStatus, resetLocalStatus } = require('../lib/utils/tuya.degraded');

module.exports = function TuyaController(tuyaManager) {
  // The diagnostics collector is an optional collaborator: record only when the manager carries it.
  const diag = (level, deviceId, event, message, data) => {
    if (typeof tuyaManager.recordDiagnostic === 'function') {
      tuyaManager.recordDiagnostic(level, deviceId, event, message, data);
    }
  };

  /**
   * @api {get} /api/v1/service/tuya/discover Retrieve tuya devices from cloud.
   * @apiName discover
   * @apiGroup Tuya
   */
  async function discover(req, res) {
    const devices = await tuyaManager.discoverDevices();
    res.json(devices);
  }

  /**
   * @api {post} /api/v1/service/tuya/local-poll Poll one Tuya device locally to retrieve DPS.
   * @apiName localPoll
   * @apiGroup Tuya
   */
  async function localPoll(req, res) {
    const payload = req.body || {};
    // Manual user-triggered local poll resets the degraded backoff so the test
    // can attempt the local path even if the automatic poll has marked it.
    resetLocalStatus(tuyaManager.degradedDevices, payload.deviceId);
    // Every manual attempt lands in the diagnostic page (one call per protocol version when the
    // front runs its full analysis) so a failing device leaves a complete verbatim trace.
    diag(
      'info',
      payload.deviceId,
      'local_dp_read_started',
      `Manual local DP read (ip=${payload.ip || 'none'} protocol=${payload.protocolVersion || 'auto'})`,
    );
    // Resolve the device's known local DP ids (mapped + deliberately ignored) so localPoll can
    // fall back to a DP_REFRESH scoped to those ids when the device rejects/ignores DP_QUERY
    // (cameras and doorbells typically do — tinytuya "device22" behaviour).
    const externalId = `tuya:${payload.deviceId}`;
    const knownDevice =
      (Array.isArray(tuyaManager.discoveredDevices) &&
        tuyaManager.discoveredDevices.find((device) => device && device.external_id === externalId)) ||
      (tuyaManager.gladys && tuyaManager.gladys.stateManager
        ? tuyaManager.gladys.stateManager.get('deviceByExternalId', externalId)
        : null);
    const requestedDps = getKnownLocalDps(knownDevice);
    let result;
    try {
      result = await tuyaManager.localPoll({ ...payload, requestedDps });
    } catch (e) {
      diag(
        'error',
        payload.deviceId,
        'local_dp_read_failed',
        `Manual local DP read failed (protocol=${payload.protocolVersion || 'auto'}): ${e.message}`,
      );
      throw e;
    }
    diag(
      'info',
      payload.deviceId,
      'local_dp_read_ok',
      `Manual local DP read succeeded (protocol=${payload.protocolVersion || 'auto'}, ${
        Object.keys(result.dps || {}).length
      } DPS${result.via ? `, via ${result.via}` : ''})`,
      result.dps,
    );
    const updatedDevice = updateDiscoveredDeviceAfterLocalPoll(tuyaManager, {
      ...payload,
      dps: result.dps,
    });

    if (updatedDevice) {
      res.json({
        ...result,
        device: updatedDevice,
      });
      return;
    }

    res.json(result);
  }

  /**
   * @api {post} /api/v1/service/tuya/local-scan Manual UDP scan for local Tuya devices.
   * @apiName localScan
   * @apiGroup Tuya
   */
  async function localScan(req, res) {
    const { timeoutSeconds } = req.body || {};
    logger.info(`[Tuya][localScan] API request received (timeoutSeconds=${timeoutSeconds || 10})`);
    diag('info', null, 'local_scan_started', `Manual UDP scan started (timeout=${timeoutSeconds || 10}s)`);
    let localScanResult;
    try {
      localScanResult = await tuyaManager.localScan({
        timeoutSeconds,
      });
    } catch (e) {
      diag('error', null, 'local_scan_failed', `Manual UDP scan failed: ${e.message}`);
      throw e;
    }
    const foundDevices = (localScanResult && localScanResult.devices) || {};
    const portErrors = (localScanResult && localScanResult.portErrors) || {};
    diag(
      'info',
      null,
      'local_scan_completed',
      `Manual UDP scan completed: ${Object.keys(foundDevices).length} device(s) answered`,
      {
        devices: Object.values(foundDevices).map((entry) => ({
          id: entry.gwId || entry.id,
          ip: entry.ip,
          version: entry.version,
        })),
        port_errors: portErrors,
      },
    );
    res.json(buildLocalScanResponse(tuyaManager, localScanResult));
  }

  /**
   * @api {get} /api/v1/service/tuya/status Get Tuya connection status.
   * @apiName status
   * @apiGroup Tuya
   */
  async function status(req, res) {
    const response = await tuyaManager.getStatus();
    res.json(response);
  }

  /**
   * @api {post} /api/v1/service/tuya/configuration Save Tuya configuration.
   * @apiName saveConfiguration
   * @apiGroup Tuya
   */
  async function saveConfiguration(req, res) {
    const configuration = await tuyaManager.saveConfiguration(req.body);
    res.json(configuration);
  }

  /**
   * @api {post} /api/v1/service/tuya/disconnect Disconnect Tuya cloud.
   * @apiName disconnect
   * @apiGroup Tuya
   */
  async function disconnect(req, res) {
    await tuyaManager.manualDisconnect();
    res.json({ success: true });
  }

  /**
   * @api {get} /api/v1/service/tuya/local-status Get the current degraded-local backoff state for Tuya devices.
   * @apiName localStatus
   * @apiGroup Tuya
   */
  async function localStatus(req, res) {
    const { deviceId } = req.query || {};
    if (deviceId) {
      const entryStatus = getLocalStatus(tuyaManager.degradedDevices, deviceId);
      res.json({ deviceId, status: entryStatus });
      return;
    }
    res.json({ devices: getAllDegraded(tuyaManager.degradedDevices) });
  }

  /**
   * @api {get} /api/v1/service/tuya/diagnostics Get structured Tuya diagnostic entries (in-memory buffer).
   * @apiName diagnostics
   * @apiGroup Tuya
   * @apiParam {string} [deviceId] Only entries for this Tuya device id.
   * @apiParam {string} [level] Minimum level (debug|info|warn|error).
   * @apiParam {number} [sinceId] Only entries with an id strictly greater (incremental polling).
   */
  async function diagnostics(req, res) {
    const { deviceId, level, sinceId } = req.query || {};
    res.json(tuyaManager.getDiagnostics({ deviceId, level, sinceId }));
  }

  /**
   * @api {get} /api/v1/service/tuya/device-snapshot Get a full debug snapshot of one Tuya device.
   * @apiName deviceSnapshot
   * @apiGroup Tuya
   * @apiParam {string} selector The Gladys device selector.
   */
  async function deviceSnapshot(req, res) {
    const { selector } = req.query || {};
    res.json(await tuyaManager.getDeviceSnapshot(selector));
  }

  return {
    'get /api/v1/service/tuya/discover': {
      authenticated: true,
      controller: asyncMiddleware(discover),
    },
    'post /api/v1/service/tuya/local-poll': {
      authenticated: true,
      controller: asyncMiddleware(localPoll),
    },
    'post /api/v1/service/tuya/local-scan': {
      authenticated: true,
      controller: asyncMiddleware(localScan),
    },
    'get /api/v1/service/tuya/status': {
      authenticated: true,
      controller: asyncMiddleware(status),
    },
    'post /api/v1/service/tuya/configuration': {
      authenticated: true,
      controller: asyncMiddleware(saveConfiguration),
    },
    'post /api/v1/service/tuya/disconnect': {
      authenticated: true,
      controller: asyncMiddleware(disconnect),
    },
    'get /api/v1/service/tuya/local-status': {
      authenticated: true,
      controller: asyncMiddleware(localStatus),
    },
    'get /api/v1/service/tuya/diagnostics': {
      authenticated: true,
      controller: asyncMiddleware(diagnostics),
    },
    'get /api/v1/service/tuya/device-snapshot': {
      authenticated: true,
      controller: asyncMiddleware(deviceSnapshot),
    },
  };
};
