/**
 * @description Initialize Midea AC LAN service: restore configured devices and start polling.
 * @example mideaAcLan.init();
 */
async function init() {
  try {
    await this.restoreConfiguredDevices();
  } catch (e) {
    this.gladys.event.emit('log', { level: 'warn', message: `Midea init: ${e.message}` });
  }
}

module.exports = {
  init,
};
