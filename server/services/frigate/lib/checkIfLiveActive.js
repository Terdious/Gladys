const logger = require('../../../utils/logger');

/**
 * @description Check if a live is active, and stop inactive lives.
 * @example
 * checkIfLiveActive();
 */
async function checkIfLiveActive() {
  logger.debug(`Frigate streaming: Checking if live is still active`);
  const promises = [];
  this.liveStreams.forEach((liveStream, cameraSelector) => {
    const { lastPing } = liveStream;
    // if last ping was more than 10 seconds ago
    if (lastPing < Date.now() - 10 * 1000) {
      logger.debug(`Frigate streaming: Live ${cameraSelector} not active, stopping live`);
      promises.push(this.stopStreaming(cameraSelector));
    }
  });
  await Promise.all(promises);
}

module.exports = {
  checkIfLiveActive,
};
