const axios = require('axios');
const logger = require('../../../../utils/logger');
/**
 * @description Set thermostat data
 * @param {string} homeId - Data received.
 * @param {string} roomId - Data received.
 * @param {string} modeThermostat - Data received.
 * @param {number} valueThermostat - Data received.
 * @example
 * setRoomThermPoint();
 */
async function setRoomThermPoint(homeId, roomId, modeThermostat, valueThermostat) {
  try {
    logger.debug(`Netatmo : New consigne thermostat : ${modeThermostat}`);
    const consThermostat = valueThermostat + 3;
    const options = {
      home_id: homeId,
      room_id: roomId,
      mode: modeThermostat,
      temp: consThermostat,
      access_token: this.token,
    };
    await axios.post(`${this.baseUrl}/api/setroomthermpoint`, options);
  } catch (err) {
    logger.info(`Error on setRoomThermPoint - ${err}`);
  }
}

module.exports = {
  setRoomThermPoint,
};
