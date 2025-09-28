const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../../../utils/logger');

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
    async rawGetToken({ accessToken, udpId }) {
        const mask = (v) => (v ? `${String(v).slice(0, 3)}***${String(v).slice(-3)}` : v);
        logger.debug(
            `MideaCloudClient.rawGetToken: provider=${this.providerName} accessToken.len=${String(accessToken || '').length} udpId=${udpId}`
        );
        const api = this.apiUrl || 'https://mp-prod.appsmb.com/mas/v5/app/proxy?alias=';
        const body = {
            appId: this.appId || '1010',
            format: 2,
            clientType: 1,
            language: 'en_US',
            src: this.appId || '1010',
            stamp: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
            reqId: crypto.randomBytes(16).toString('hex'),
            udpid: udpId
        };
        const payload = JSON.stringify(body);
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
            stamp: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
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
            const loginId = dataLoginId && dataLoginId.data && dataLoginId.data.loginId;
            logger.debug(`MideaCloudClient.authenticate: loginId=${loginId}`);
            if (!loginId) return null;

            // 2) login to get accessToken
            const deviceId = crypto.randomBytes(8).toString('hex');
            const bodyLogin = {
                appId: '1010',
                format: 2,
                clientType: 1,
                language: 'en_US',
                src: '1010',
                stamp: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
                reqId: crypto.randomBytes(16).toString('hex'),
                data: {
                    appKey: this.appKey,
                    deviceId,
                    platform: 2
                },
                iotData: {
                    appId: '1010',
                    clientType: 1,
                    iampwd: crypto.createHash('sha256').update(loginId + crypto.createHash('md5').update(crypto.createHash('md5').update(password).digest('hex')).digest('hex') + this.appKey).digest('hex'),
                    loginAccount: uid,
                    password: crypto.createHash('sha256').update(loginId + crypto.createHash('sha256').update(password).digest('hex') + this.appKey).digest('hex'),
                    pushToken: crypto.randomBytes(120).toString('base64'),
                    reqId: crypto.randomBytes(16).toString('hex'),
                    src: '1010',
                    stamp: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
                }
            };
            const payloadLogin = JSON.stringify(bodyLogin);
            const randomLogin = Math.floor(Date.now() / 1000).toString();
            const signLogin = crypto.createHmac('sha256', 'PROD_VnoClJI9aikS8dyy').update(`meicloud${payloadLogin}${randomLogin}`).digest('hex');
            const headersLogin = { sign: signLogin, secretVersion: '1', random: randomLogin, 'Content-Type': 'application/json' };
            const urlLogin = `${api}/mj/user/login`;
            const { data: dataLogin } = await this.http.post(urlLogin, bodyLogin, { headers: headersLogin });
            const accessToken =
                dataLogin && dataLogin.data && dataLogin.data.mdata && dataLogin.data.mdata.accessToken;
            logger.debug(`MideaCloudClient.authenticate: accessToken.len=${String(accessToken || '').length}`);
            return accessToken || null;
        } catch (e) {
            logger.debug(`MideaCloudClient.authenticate error: ${e && e.message}`);
            throw e;
        }
    }
}

module.exports = { MideaCloudClient };


