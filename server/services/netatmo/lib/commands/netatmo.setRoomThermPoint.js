const axios = require('axios');
const logger = require('../../../../utils/logger');
/**
 * @description Set thermostat data
 * @example
 * setRoomThermPoint();
 */
async function setRoomThermPoint(home_id, room_id, mode, valueThermostat) {
  try {
  logger.debug(`Netatmo : New consigne thermostat : ${mode}`);
  const consThermostat = valueThermostat + 3
    const options = {
      home_id: home_id,
      room_id: room_id,
      mode: mode,
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
