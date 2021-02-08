const { delay } = require('bluebird');

/**
 * @description Poll value of a Netatmo devices
 * @example
 * pollManual();
 */
async function pollManual() {
  setInterval(async () => {
    await this.getHealthyHomeCoachData();
    await this.getStationsData();
    await this.updateNetatmo('HomeCoach_Weather');
  }, this.pollFrequencies.EVERY_5_MINUTES);
  setInterval(async () => {
    this.setThermostat.valvesHeatingRequest = 0;
    await this.getThermostatsData();
    await this.getHomeStatusData();
    await this.updateNetatmo('Energy');
    await delay(200);
    if (this.setThermostat.thermostatHeatingRequest === 0 && this.setThermostat.valvesHeatingRequest > 0) {
      await this.setRoomThermPoint(
        '5e147b4da11ec5d9f86b25a2',
        '299775816',
        'manual',
        this.setThermostat.tempThermostat,
      );
    }
    if (this.setThermostat.thermostatHeatingRequest === 1 && this.setThermostat.valvesHeatingRequest === 0) {
      await this.setRoomThermPoint('5e147b4da11ec5d9f86b25a2', '299775816', 'home', 0);
    }
  }, this.pollFrequencies.EVERY_2_MINUTES);
  setInterval(async () => {
    await this.getHomeData();
    await this.updateNetatmo('Security');
  }, this.pollFrequencies.EVERY_MINUTES);
}

module.exports = {
  pollManual,
};
