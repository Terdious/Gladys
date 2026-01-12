const { WEBSOCKET_MESSAGE_TYPES, EVENTS } = require('../../../utils/constants');
const logger = require('../../../utils/logger');
const { STATUS } = require('./utils/tesla.constants');

/**
 * @description Post Tesla status.
 * @param {object} status - Configuration to save.
 * @returns {object} Current Tesla network status.
 * @example
 * status({statusType: 'connecting', message: 'invalid_client'});
 */
function saveStatus(status) {
  logger.debug('Changing status Tesla...');
  try {
    switch (status.statusType) {
      case STATUS.ERROR.CONNECTING:
        this.status = STATUS.DISCONNECTED;
        this.connected = false;
        this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
          type: WEBSOCKET_MESSAGE_TYPES.TESLA.ERROR.CONNECTING,
          payload: { statusType: STATUS.CONNECTING, status: status.message },
        });
        break;
      case STATUS.ERROR.PROCESSING_TOKEN:
        this.status = STATUS.DISCONNECTED;
        this.connected = false;
        this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
          type: WEBSOCKET_MESSAGE_TYPES.TESLA.ERROR.PROCESSING_TOKEN,
          payload: { statusType: STATUS.PROCESSING_TOKEN, status: status.message },
        });
        break;
      case STATUS.ERROR.CONNECTED:
        this.configured = true;
        this.status = STATUS.DISCONNECTED;
        this.connected = false;
        this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
          type: WEBSOCKET_MESSAGE_TYPES.TESLA.ERROR.CONNECTED,
          payload: { statusType: STATUS.CONNECTED, status: status.message },
        });
        break;
      case STATUS.ERROR.GET_VEHICLES:
        this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
          type: WEBSOCKET_MESSAGE_TYPES.TESLA.ERROR.CONNECTED,
          payload: { statusType: STATUS.CONNECTED, status: status.message },
        });
        break;

      case STATUS.NOT_INITIALIZED:
        this.configured = false;
        this.status = STATUS.NOT_INITIALIZED;
        this.connected = false;
        this.stopPolling();
        break;
      case STATUS.CONNECTING:
        this.configured = true;
        this.status = STATUS.CONNECTING;
        this.connected = false;
        break;
      case STATUS.PROCESSING_TOKEN:
        this.configured = true;
        this.status = STATUS.PROCESSING_TOKEN;
        this.connected = false;
        break;
      case STATUS.CONNECTED:
        this.configured = true;
        this.status = STATUS.CONNECTED;
        this.connected = true;
        break;
      case STATUS.DISCONNECTING:
        this.configured = true;
        this.status = STATUS.DISCONNECTING;
        break;
      case STATUS.DISCONNECTED:
        this.configured = true;
        this.status = STATUS.DISCONNECTED;
        this.connected = false;
        this.stopPolling();
        break;
      case STATUS.DISCOVERING_VEHICLES:
        this.configured = true;
        this.status = STATUS.DISCOVERING_VEHICLES;
        this.connected = true;
        break;
      case STATUS.GET_VEHICLES:
        this.configured = true;
        this.status = STATUS.GET_VEHICLES;
        this.connected = true;
        break;

      default:
        break;
    }
    logger.debug('Status Tesla well changed');
    this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.TESLA.STATUS,
      payload: { status: this.status },
    });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  saveStatus,
};
