/**
 * @description Get Tesla status.
 * @returns {object} Current Tesla network status.
 * @example
 * status();
 */
function getStatus() {
  const teslaStatus = {
    configured: this.configured,
    connected: this.connected,
    status: this.status,
  };
  return teslaStatus;
}

module.exports = {
  getStatus,
};
