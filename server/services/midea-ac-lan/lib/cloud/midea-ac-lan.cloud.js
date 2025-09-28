const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../../../utils/logger');

// Copy EXACT timestamp function from node-mideahvac
function strftime(format) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    return format
        .replace('%Y', year)
        .replace('%m', month)
        .replace('%d', day)
        .replace('%H', hour)
        .replace('%M', minute)
        .replace('%S', second);
}

// Copy EXACT encryption functions from node-mideahvac
function encryptIAMPassword(appKey, loginId, password) {
    const passwordHash = crypto.createHash('md5').update(password).digest('hex');
    const password2ndHash = crypto.createHash('md5').update(passwordHash).digest('hex');
    return crypto.createHash('sha256').update(loginId + password2ndHash + appKey).digest('hex');
}

function encryptPassword(appKey, loginId, password) {
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    return crypto.createHash('sha256').update(loginId + passwordHash + appKey).digest('hex');
}

class MideaCloudClient {
    constructor(opts = {}) {
        this.providers = {
            // Aligné sur MSmartHome de l’intégration HA
            MSmartHome: {
                app_id: '1010',
                app_key: 'ac21b9f9cbfe4ca5a88562ef25e2b768',
                // iot_key/hmac_key seront renseignés si nécessaires (selon cloud.py)
                iot_key: '',
                hmac_key: '',
                api_url: 'https://mp-prod.appsmb.com/mas/v5/app/proxy?alias=',
            },
            // Placeholders pour futurs providers
            MideaAir: {
                app_id: '1117',
                app_key: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                iot_key: '',
                hmac_key: '',
                api_url: 'https://mapp.appsmb.com/mas/v5/app/proxy?alias=',
            },
            NetHomePlus: {
                app_id: '1017',
                app_key: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                iot_key: '',
                hmac_key: '',
                api_url: 'https://odm.appsmb.com/mas/v5/app/proxy?alias=',
            },
        };
        this.providerName = opts.provider || 'MSmartHome';
        const p = this.providers[this.providerName] || this.providers.MSmartHome;
        this.apiUrl = p.api_url;
        this.appId = p.app_id;
        this.appKey = p.app_key;
        this.iotKey = p.iot_key || '';
        this.hmacKey = p.hmac_key || '';
        this.http = axios.create({ timeout: 10000 });
        this.session = null;
    }

    setProvider(name) {
        if (name && this.providers[name]) {
            this.providerName = name;
            const p = this.providers[name];
            this.apiUrl = p.api_url;
            this.appId = p.app_id;
            this.appKey = p.app_key;
            this.iotKey = p.iot_key || '';
            this.hmacKey = p.hmac_key || '';
        }
    }

    async login(username, password) {
        // TODO: Implémentation complète des appels signés (alias + HMAC) inspirée de cloud.py
        // En attendant l'implémentation réelle, ne pas simuler une session réussie.
        this.session = null;
        return null;
    }

    async listAppliances() {
        if (!this.session) return [];
        // TODO: Retourner la vraie liste depuis le cloud Midea (puis mapper id/host/key/token)
        return [];
    }

    // Low-level direct call to getToken using current provider
    async rawGetToken({ accessToken, udpId, deviceId }) {
        const mask = (v) => (v ? `${String(v).slice(0, 3)}***${String(v).slice(-3)}` : v);
        logger.debug(
            `MideaCloudClient.rawGetToken: provider=${this.providerName} accessToken.len=${String(accessToken || '').length} udpId=${udpId} deviceId=${deviceId}`
        );

        // FORCE fresh authentication if accessToken looks too short
        if (!accessToken || String(accessToken).length < 32) {
            logger.warn(`MideaCloudClient.rawGetToken: accessToken too short (${String(accessToken || '').length}), forcing re-auth`);
            throw new Error('ACCESS_TOKEN_TOO_SHORT');
        }

        const api = this.apiUrl || 'https://mp-prod.appsmb.com/mas/v5/app/proxy?alias=';

        // Copy EXACTLY what node-mideahvac does - ONLY udpid, no deviceId!
        const body = {
            appId: this.appId || '1010',
            format: 2,
            clientType: 1,
            language: 'en_US',
            src: this.appId || '1010',
            stamp: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
            reqId: crypto.randomBytes(16).toString('hex'),
            udpid: udpId
            // NO deviceId - node-mideahvac doesn't send it!
        };
        const payload = JSON.stringify(body);
        logger.debug(`MideaCloudClient.rawGetToken: payload=${payload.substring(0, 300)}`);
        const random = Math.floor(Date.now() / 1000).toString();
        const sign = crypto
            .createHmac('sha256', 'PROD_VnoClJI9aikS8dyy')
            .update(`meicloud${payload}${random}`)
            .digest('hex');
        const headers = {
            sign,
            secretVersion: '1',
            random,
            'Content-Type': 'application/json',
            accessToken: accessToken || ''
        };
        const url = `${api}/v1/iot/secure/getToken`;
        try {
            const { data } = await this.http.post(url, body, { headers });
            logger.debug(
                `MideaCloudClient.rawGetToken: code=${data && data.code} tokenlist.size=${(data && data.data && data.data.tokenlist && data.data.tokenlist.length) || 0
                }`
            );
            return data;
        } catch (e) {
            logger.debug(`MideaCloudClient.rawGetToken error: ${e && e.message}`);
            throw e;
        }
    }

    async authenticate(uid, password) {
        const api = this.apiUrl || 'https://mp-prod.appsmb.com/mas/v5/app/proxy?alias=';
        const mask = (v) => (v ? `${String(v).slice(0, 3)}***${String(v).slice(-3)}` : v);
        logger.debug(`MideaCloudClient.authenticate: uid=${mask(uid)} provider=${this.providerName}`);
        // 1) get login id
        const bodyId = {
            appId: this.appId || '1010',
            format: 2,
            clientType: 1,
            language: 'en_US',
            src: this.appId || '1010',
            stamp: strftime('%Y%m%d%H%M%S'),
            deviceId: crypto.randomBytes(8).toString('hex'),
            reqId: crypto.randomBytes(16).toString('hex'),
            loginAccount: uid
        };
        const payloadId = JSON.stringify(bodyId);
        const randomId = Math.floor(Date.now() / 1000).toString();
        const signId = crypto
            .createHmac('sha256', 'PROD_VnoClJI9aikS8dyy')
            .update(`meicloud${payloadId}${randomId}`)
            .digest('hex');
        const headersId = { sign: signId, secretVersion: '1', random: randomId, 'Content-Type': 'application/json' };
        const urlId = `${api}/v1/user/login/id/get`;
        try {
            const { data: dataLoginId } = await this.http.post(urlId, bodyId, { headers: headersId });
            logger.debug(`MideaCloudClient.authenticate: loginId response: ${JSON.stringify(dataLoginId).substring(0, 300)}`);
            const loginId = dataLoginId && dataLoginId.data && dataLoginId.data.loginId;
            logger.debug(`MideaCloudClient.authenticate: loginId=${loginId}`);
            if (!loginId) return null;

            // Store loginId in instance like node-mideahvac does
            this._loginId = loginId;

            // 2) login to get accessToken - COPY EXACT node-mideahvac format
            const deviceId = crypto.randomBytes(8).toString('hex');
            const bodyLogin = {
                appId: '1010',
                format: 2,
                clientType: 1,
                language: 'en_US',
                src: '1010',
                stamp: strftime('%Y%m%d%H%M%S'),
                reqId: crypto.randomBytes(16).toString('hex'),
                data: {
                    appKey: this.appKey,
                    deviceId: deviceId,
                    platform: 2
                },
                iotData: {
                    appId: '1010',
                    clientType: 1,
                    iampwd: encryptIAMPassword(this.appKey, this._loginId, password),
                    loginAccount: uid,
                    password: encryptPassword(this.appKey, this._loginId, password),
                    pushToken: crypto.randomBytes(120).toString('base64'),
                    reqId: crypto.randomBytes(16).toString('hex'),
                    src: '1010',
                    stamp: strftime('%Y%m%d%H%M%S')
                }
            };
            logger.debug(`MideaCloudClient.authenticate: sending payload: ${JSON.stringify(bodyLogin).substring(0, 800)}`);
            const payloadLogin = JSON.stringify(bodyLogin);
            const randomLogin = Math.floor(Date.now() / 1000).toString();
            const signLogin = crypto.createHmac('sha256', 'PROD_VnoClJI9aikS8dyy').update(`meicloud${payloadLogin}${randomLogin}`).digest('hex');
            const headersLogin = {
                sign: signLogin,
                secretVersion: '1',
                random: randomLogin,
                'Content-Type': 'application/json'
                // NO accessToken for login call - we don't have one yet!
            };
            const urlLogin = `${api}/mj/user/login`;
            const { data: dataLogin } = await this.http.post(urlLogin, bodyLogin, { headers: headersLogin });
            logger.debug(`MideaCloudClient.authenticate: login response: ${JSON.stringify(dataLogin).substring(0, 500)}`);

            // DEBUG: Check if login succeeded
            if (dataLogin && dataLogin.code === '0') {
                logger.info(`MideaCloudClient.authenticate: Login SUCCESS! Code: ${dataLogin.code}`);
            } else {
                logger.error(`MideaCloudClient.authenticate: Login FAILED! Code: ${dataLogin && dataLogin.code}, Msg: ${dataLogin && dataLogin.msg}`);
                logger.error(`MideaCloudClient.authenticate: Full response: ${JSON.stringify(dataLogin)}`);
                return null; // Don't continue if login failed
            }

            const accessToken =
                dataLogin && dataLogin.data && dataLogin.data.mdata && dataLogin.data.mdata.accessToken;

            // Stocker dans la session
            if (!this.session) this.session = {};
            this.session.accessToken = accessToken;
            this.session.loginId = this._loginId;

            logger.debug(`MideaCloudClient.authenticate: accessToken.len=${String(accessToken || '').length}`);
            return accessToken || null;
        } catch (e) {
            logger.debug(`MideaCloudClient.authenticate error: ${e && e.message}`);
            throw e;
        }
    }

    // Getters pour compatibilité avec l'ancienne interface
    get _accessToken() {
        return this.session?.accessToken || null;
    }

    set _accessToken(value) {
        if (!this.session) this.session = {};
        this.session.accessToken = value;
    }

    get _loginId() {
        return this.session?.loginId || null;
    }

    set _loginId(value) {
        if (!this.session) this.session = {};
        this.session.loginId = value;
    }

    get _appKey() {
        return this.appKey;
    }
}

module.exports = { MideaCloudClient };


