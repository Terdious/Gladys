const { fetch } = require('undici');

const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

const { STATUS, AUTHENTICATION } = require('./utils/tesla.constants');

/**
 * @description Tesla retrieve access and refresh token method.
 * @param {object} body - Tesla code to retrieve access tokens.
 * @returns {Promise<object>} Tesla access token.
 * @example
 * await tesla.retrieveTokens(
 *  {codeOAuth, state, redirectUri},
 * );
 */
async function retrieveTokens(body) {
    logger.debug('Getting tokens to Tesla API...');
    const { clientId, clientSecret, scopes } = this.configuration;
    const { codeOAuth, state, redirectUri } = body;
    if (!clientId || !clientSecret || !codeOAuth) {
        await this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
        throw new ServiceNotConfiguredError('Tesla is not configured.');
    }
    if (state !== this.stateGetAccessToken) {
        await this.saveStatus({ statusType: STATUS.DISCONNECTED, message: null });
        throw new ServiceNotConfiguredError(
            'Tesla did not connect correctly. The return does not correspond to the initial request',
        );
    }
    await this.saveStatus({ statusType: STATUS.PROCESSING_TOKEN, message: null });
    const scopeValues = Object.values(scopes).join(' ');
    const authentificationForm = {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        audience: AUTHENTICATION.audience.EU,
        scope: scopeValues,
        code: body.codeOAuth,
    };
    try {
        const response = await fetch(AUTHENTICATION.urlToken, {
            method: 'POST',
            headers: {
                'Content-Type': AUTHENTICATION.HEADER.CONTENT_TYPE,
            },
            body: new URLSearchParams(authentificationForm).toString(),
        });
        const rawBody = await response.text();
        if (!response.ok) {
            logger.error('Error getting new accessToken to Tesla - Details: ', response.status, rawBody);
            throw new Error(`HTTP error ${response.status} - ${rawBody}`);
        }
        const data = JSON.parse(rawBody);
        const tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expireIn: data.expires_in,
        };
        await this.setTokens(tokens);
        this.accessToken = tokens.accessToken;
        await this.saveStatus({ statusType: STATUS.CONNECTED });
        logger.debug('Tesla new access tokens well loaded');
        if (this.configuration.vehicleApi || this.configuration.energyApi) {
            await this.startPolling();
        }
        return { success: true };
    } catch (e) {
        this.saveStatus({
            statusType: STATUS.ERROR.PROCESSING_TOKEN,
            message: 'get_access_token_fail',
        });
        logger.error('Error getting new accessToken to Tesla - Details: ', e);
        throw new ServiceNotConfiguredError(`TESLA: Service is not connected with error ${e}`);
    }
}

module.exports = {
    retrieveTokens,
}; 