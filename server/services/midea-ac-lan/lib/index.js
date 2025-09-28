const { init } = require('./midea-ac-lan.init');
const { disconnect } = require('./midea-ac-lan.disconnect');
const { discover } = require('./midea-ac-lan.discover');
const { saveDevice } = require('./midea-ac-lan.saveDevice');
const { restoreConfiguredDevices } = require('./midea-ac-lan.restoreConfiguredDevices');
const { _attach, _publishStatus } = require('./midea-ac-lan.attach');
const { setFeatureValue } = require('./midea-ac-lan.setFeatureValue');
const { listDevices } = require('./midea-ac-lan.listDevices');
const { MideaCloudClient } = require('./cloud/midea-ac-lan.cloud');
const CloudConnection = require('node-mideahvac/lib/cloud.js');
const logger = require('../../../utils/logger');
const { scanHosts } = require('./midea-ac-lan.scanHosts');
const { STATUS } = require('./utils/midea-ac-lan.constants');

const MideaAcLanHandler = function MideaAcLanHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;
  this.status = STATUS.DISCONNECTED;
  this.clients = new Map();
  this.cloud = new MideaCloudClient();
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

MideaAcLanHandler.prototype.confirmDevice = async function confirmDevice({ id, udpId }) {
  const logger = require('../../../utils/logger');
  let uid;
  let pwd;
  try { uid = await this.gladys.variable.getValue('MIDEA_USER', this.serviceId); } catch (e) { }
  try { pwd = await this.gladys.variable.getValue('MIDEA_PASSWORD', this.serviceId); } catch (e) { }
  if (!uid || !pwd) {
    throw new Error('CLOUD_NOT_CONFIGURED');
  }
  if (!udpId && !id) {
    throw new Error('DEVICE_ID_REQUIRED');
  }
  const CloudConnection = require('node-mideahvac/lib/cloud.js');
  try {
    const deviceIdHex = (id || '').toString(16);
    const cc = this.cloudClient || new CloudConnection({ uid, password: pwd });
    if (!this.cloudClient) {
      try { await cc._authenticate(); this.cloudClient = cc; } catch (e) { }
    }
    logger.info(`Midea AC LAN: confirmDevice -> getToken id=${id} udpId=${udpId}`);
    let key;
    let token;
    try {
      // ensure login id context is bound to this device id
      try { await this.cloudClient._authenticate(deviceIdHex); } catch (eBind) { }
      logger.debug(
        `Midea confirmDevice: attempt1 idHex=${deviceIdHex} udpId=${udpId} loginId=${this.cloudClient._loginId} token.len=${String(
          this.cloudClient._accessToken || ''
        ).length}`
      );
      const pair = await this.cloudClient.getToken(deviceIdHex, udpId);
      logger.debug(`Midea confirmDevice: attempt1 ok=${!!(pair && pair.key && pair.token)}`);
      key = pair && pair.key;
      token = pair && pair.token;
    } catch (eTok) {
      logger.warn(`Midea AC LAN: confirmDevice attempt1 error: ${eTok && (eTok.stack || eTok.message)}`);
      // retry variants: uppercase udpid then decimal id
      try {
        const up = String(udpId || '').toUpperCase();
        logger.debug('Midea confirmDevice: attempt2 with UDPID upper');
        const pair2 = await this.cloudClient.getToken(deviceIdHex, up);
        logger.debug(`Midea confirmDevice: attempt2 ok=${!!(pair2 && pair2.key && pair2.token)}`);
        key = pair2 && pair2.key;
        token = pair2 && pair2.token;
      } catch (eTok2) {
        logger.warn(`Midea AC LAN: confirmDevice attempt2 error: ${eTok2 && (eTok2.stack || eTok2.message)}`);
      }
      if (!key || !token) {
        try {
          const decId = String(id || '');
          logger.debug('Midea confirmDevice: attempt3 with decimal id');
          const pair3 = await this.cloudClient.getToken(decId, udpId);
          logger.debug(`Midea confirmDevice: attempt3 ok=${!!(pair3 && pair3.key && pair3.token)}`);
          key = pair3 && pair3.key;
          token = pair3 && pair3.token;
        } catch (eTok3) {
          logger.warn(`Midea AC LAN: confirmDevice attempt3 error: ${eTok3 && (eTok3.stack || eTok3.message)}`);
        }
      }
      // fallback: call low-level API to see raw response and pick matching udpid
      if (!key || !token) {
        try {
          // try raw call via our axios wrapper as well
          let accessToken = this.cloudClient._accessToken;
          const { MideaCloudClient } = require('./cloud/midea-ac-lan.cloud');
          const helper = new MideaCloudClient({ provider: 'MSmartHome' });
          // Always re-auth to ensure valid token before raw call
          try {
            const fresh = await helper.authenticate(uid, pwd);
            if (fresh) accessToken = fresh;
          } catch (eAuth2) { }
          logger.debug(`Midea confirmDevice: raw call accessToken.len=${String(accessToken || '').length}`);
          const raw = await helper.rawGetToken({ accessToken, udpId });
          logger.debug(
            `Midea confirmDevice: raw tokenlist size=${(raw && raw.data && raw.data.tokenlist && raw.data.tokenlist.length) || 0}`
          );
          logger.info(`Midea AC LAN: raw getToken response: ${JSON.stringify(raw)}`);
          const list = (raw && raw.data && raw.data.tokenlist) || [];
          const found = list.find((p) => p && String(p.udpId || '').toLowerCase() === String(udpId || '').toLowerCase()) || list[0];
          if (found) { key = found.key; token = found.token; }
        } catch (eLow) {
          logger.warn(`Midea AC LAN: raw getToken error: ${eLow && (eLow.stack || eLow.message)}`);
        }
      }
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
