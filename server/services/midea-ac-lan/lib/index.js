const { init } = require('./midea-ac-lan.init');
const { disconnect } = require('./midea-ac-lan.disconnect');
const { discover } = require('./midea-ac-lan.discover');
const { saveDevice } = require('./midea-ac-lan.saveDevice');
const { restoreConfiguredDevices } = require('./midea-ac-lan.restoreConfiguredDevices');
const { _attach, _publishStatus } = require('./midea-ac-lan.attach');
const { setFeatureValue } = require('./midea-ac-lan.setFeatureValue');
const { listDevices } = require('./midea-ac-lan.listDevices');
// const { MideaCloudClient } = require('./cloud/midea-ac-lan.cloud');
const CloudConnection = require('node-mideahvac/lib/cloud.js');
const logger = require('../../../utils/logger');
const { scanHosts } = require('./midea-ac-lan.scanHosts');
const { STATUS } = require('./utils/midea-ac-lan.constants');

const MideaAcLanHandler = function MideaAcLanHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;
  this.status = STATUS.DISCONNECTED;
  this.clients = new Map();
  // this.cloud = new MideaCloudClient();
  this.tokenCache = new Map(); // udpId/id -> { key, token }
};

MideaAcLanHandler.prototype.init = init;
MideaAcLanHandler.prototype.disconnect = disconnect;
MideaAcLanHandler.prototype.discover = discover;
MideaAcLanHandler.prototype.saveDevice = saveDevice;
MideaAcLanHandler.prototype.restoreConfiguredDevices = restoreConfiguredDevices;
MideaAcLanHandler.prototype._attach = _attach;
MideaAcLanHandler.prototype._publishStatus = _publishStatus;
MideaAcLanHandler.prototype.setFeatureValue = setFeatureValue;
// Alias to match Gladys core expectation "setValue"
MideaAcLanHandler.prototype.setValue = setFeatureValue;
MideaAcLanHandler.prototype.listDevices = listDevices;
MideaAcLanHandler.prototype.scanHosts = scanHosts;

// Ancienne fonction confirmDevice restaurée

// Ensure we have a usable cloud client from stored variables (token reused if present)
MideaAcLanHandler.prototype.ensureCloudClient = async function ensureCloudClient() {
  if (this.cloudClient) return this.cloudClient;
  let uid;
  let pwd;
  let token;
  try { uid = await this.gladys.variable.getValue('MIDEA_USER', this.serviceId); } catch (e) { }
  try { pwd = await this.gladys.variable.getValue('MIDEA_PASSWORD', this.serviceId); } catch (e) { }
  try { token = await this.gladys.variable.getValue('MIDEA_ACCESS_TOKEN', this.serviceId); } catch (e) { }
  if (!uid || !pwd) return null;
  const cc = new CloudConnection({ uid, password: pwd });
  if (token) cc._accessToken = token;
  try {
    const mask = (v) => (v ? `${String(v).slice(0, 3)}***${String(v).slice(-3)}` : v);
    logger.debug(`Midea ensureCloudClient: uid=${mask(uid)} token=${token ? `len:${String(token).length}` : 'none'}`);
    // If token invalid, _apiRequest will fail later and we can reauth on demand
    this.cloudClient = cc;
    return this.cloudClient;
  } catch (e) {
    logger.debug(`Midea ensureCloudClient: failed to init client - ${e.message}`);
    return null;
  }
};

MideaAcLanHandler.prototype.connectCloud = async function connectCloud({ user, password }) {
  const mask = (v) => (v ? `${String(v).slice(0, 2)}***${String(v).slice(-2)}` : v);
  logger.info(`Midea AC LAN: cloud connect (node-mideahvac) for ${mask(user)}`);
  try {
    // Persist variables
    if (user) await this.gladys.variable.setValue('MIDEA_USER', user, this.serviceId);
    if (password) await this.gladys.variable.setValue('MIDEA_PASSWORD', password, this.serviceId);

    // Init/replace cloud client
    const cc = new CloudConnection({ uid: user, password });
    try {
      const ret = await cc._authenticate();
      // Persist returned auth fields for reuse
      try { await this.gladys.variable.setValue('MIDEA_ACCESS_TOKEN', cc._accessToken || '', this.serviceId); } catch (eTok) { }
      try { await this.gladys.variable.setValue('MIDEA_LOGIN_ID', cc._loginId || '', this.serviceId); } catch (eL) { }
      try { await this.gladys.variable.setValue('MIDEA_APP_KEY', cc._appKey || '', this.serviceId); } catch (eK) { }
      logger.debug(`Midea connectCloud: loginId=${cc._loginId} appKey=${(cc._appKey || '').slice(0, 3)}*** accessToken.len=${String(cc._accessToken || '').length}`);
      this.cloudClient = cc;

      // If token looks invalid/short, try JS helper auth and replace
      try {
        if (!cc._accessToken || String(cc._accessToken).length < 32) {
          const { MideaCloudClient } = require('./cloud/midea-ac-lan.cloud');
          const helper = new MideaCloudClient({ provider: 'MSmartHome' });
          const fresh = await helper.authenticate(user, password);
          if (fresh) {
            this.cloudClient._accessToken = fresh;
            await this.gladys.variable.setValue('MIDEA_ACCESS_TOKEN', fresh, this.serviceId);
            logger.debug(`Midea connectCloud: replaced accessToken.len=${String(fresh).length}`);
          }
        }
      } catch (eReauth) { }
      logger.info('Midea AC LAN: cloud authenticated');
      return { connected: true, devices: [], auth: ret };
    } catch (authErr) {
      logger.warn(`Midea AC LAN: cloud auth failed - ${authErr.message}`);
      this.cloudClient = null;
      return { connected: false, devices: [] };
    }
  } catch (e) {
    logger.warn(`Midea AC LAN: cloud connect failed - ${e.message}`);
    throw e;
  }
};

MideaAcLanHandler.prototype.cloudStatus = async function cloudStatus() {
  return { connected: !!this.cloudClient };
};

MideaAcLanHandler.prototype.confirmDevice = async function confirmDevice({ id, udpId, host, rawUdpResponse }) {
  const logger = require('../../../utils/logger');
  let uid;
  let pwd;
  try { uid = await this.gladys.variable.getValue('MIDEA_USER', this.serviceId); } catch (e) { }
  try { pwd = await this.gladys.variable.getValue('MIDEA_PASSWORD', this.serviceId); } catch (e) { }
  if (!uid || !pwd) {
    throw new Error('CLOUD_NOT_CONFIGURED');
  }
  logger.debug(`Midea confirmDevice: received id=${id} udpId=${udpId} host=${host} rawUdpResponse=${rawUdpResponse ? 'YES' : 'NO'}`);

  if (!udpId && !id && !host) {
    throw new Error('DEVICE_ID_OR_HOST_REQUIRED');
  }

  // If we have host but no ID, try to discover it first
  if (!id && host) {
    logger.info(`Midea AC LAN: No device ID provided, attempting UDP discovery on ${host}`);
    try {
      const { udpDiscoverTarget } = require('./midea-ac-lan.discover');
      const discovered = await udpDiscoverTarget(host);
      if (discovered && discovered.id) {
        id = discovered.id;
        udpId = discovered.udpId;
        logger.info(`Midea AC LAN: Discovered device ID ${id} via UDP`);
      }
    } catch (eDisc) {
      logger.warn(`Midea AC LAN: UDP discovery failed: ${eDisc.message}`);
    }
  }
  // const CloudConnection = require('node-mideahvac/lib/cloud.js'); // Remplacé par MideaCloudClient
  try {
    logger.info(`Midea AC LAN: confirmDevice -> LOCAL negotiation ONLY id=${id} udpId=${udpId} host=${host}`);
    let key;
    let token;

    // PURE LOCAL AUTHENTICATION - like wuwentao/midea_ac_lan (NO CLOUD!)
    // HA does NOT use cloud authentication - it does pure local handshake
    logger.info(`Midea AC LAN: Pure LOCAL authentication like wuwentao/midea_ac_lan (NO CLOUD)`);

    try {
      // Use our MideaLocalAuth implementation for PURE local auth
      const { MideaLocalAuth } = require('./protocol/midea-local-auth');
      const auth = new MideaLocalAuth();

      // Pure local authentication - no cloud token needed!
      // This is exactly how HA works with wuwentao/midea_ac_lan
      // Use the UDP response we already have from discovery (no need to re-fetch!)
      let udpResponse = null;

      // Look for existing UDP response in the discovery data we already have
      // The udpId parameter comes from the discovery, so we should have the raw response
      logger.debug(`MideaLocalAuth: Looking for existing UDP response for udpId=${udpId}`);

      // Use the rawUdpResponse from the FIRST discovery (passed from front-end)
      if (rawUdpResponse) {
        udpResponse = rawUdpResponse;
        logger.info(`MideaLocalAuth: Using rawUdpResponse from FIRST discovery (front-end): ${udpResponse.slice(-64)}`);
      } else {
        // Fallback: Get FRESH UDP response if not provided
        try {
          logger.debug(`MideaLocalAuth: No rawUdpResponse provided, performing fresh UDP discovery`);
          const { udpDiscoverTarget } = require('./midea-ac-lan.discover');

          const udpResult = await udpDiscoverTarget(host);

          if (udpResult && udpResult.rawUdpResponse) {
            udpResponse = udpResult.rawUdpResponse;
            logger.info(`MideaLocalAuth: Got FRESH UDP response with dynamic token: ${udpResponse.slice(-64)}`);
          } else {
            logger.warn(`MideaLocalAuth: No rawUdpResponse in fresh UDP result`);
          }
        } catch (eUdp) {
          logger.warn(`MideaLocalAuth: Could not get fresh UDP response: ${eUdp.message}`);
        }
      }

      // EXTRACT Token AND Key directly from UDP response (like Home Assistant!)
      // No need for TCP handshake - HA gets everything from UDP!
      try {
        function extractTokenFromRawUdp(rawHex) {
          const hex = String(rawHex || '').toLowerCase().replace(/[^0-9a-f]/g, '');
          if (hex.length < 64) return null;

          // Token = DERNIERS 32 octets (64 hex chars)
          const token = hex.slice(-64);
          return /^[0-9a-f]{64}$/.test(token) ? token : null;
        }

        const extractedToken = extractTokenFromRawUdp(udpResponse);
        if (extractedToken) {
          // In Midea protocol, token and key are often the same or derived from the same source
          token = extractedToken;
          key = extractedToken; // Same as token for local authentication

          logger.info(`Midea AC LAN: SUCCESS! Extracted Token/Key from UDP like HA`);
          logger.debug(`Midea AC LAN: token=${token.substring(0, 8)}... key=${key.substring(0, 8)}...`);
        } else {
          logger.warn(`Midea AC LAN: Could not extract token from UDP response`);

          // Fallback: Try TCP handshake
          const authResult = await auth.authenticatePureLocal(host, 6444, id, udpResponse);
          if (authResult && authResult.success && authResult.token && authResult.key) {
            token = authResult.token;
            key = authResult.key;
            logger.info(`Midea AC LAN: SUCCESS! TCP handshake fallback`);
          }
        }
      } catch (eExtract) {
        logger.warn(`Midea AC LAN: Token extraction error: ${eExtract.message}`);
      }

    } catch (eLoc) {
      logger.warn(`Midea AC LAN: Pure local authentication error: ${eLoc && (eLoc.stack || eLoc.message)}`);
    }
    const result = { key, token };
    logger.debug(`Midea confirmDevice: result hasToken=${!!token} hasKey=${!!key}`);
    return result;
  } catch (e) {
    logger.warn(`Midea AC LAN: confirmDevice failed - ${e && (e.stack || e.message)}`);
    throw e;
  }
};

MideaAcLanHandler.prototype.clearCloudCache = async function clearCloudCache() {
  try {
    await this.gladys.variable.setValue('MIDEA_USER', '', this.serviceId);
  } catch (e) { }
  try {
    await this.gladys.variable.setValue('MIDEA_PASSWORD', '', this.serviceId);
  } catch (e2) { }
  this.cloud.session = null;
  return { cleared: true };
};

module.exports = MideaAcLanHandler;
