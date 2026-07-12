const portfinder = require('portfinder');

const logger = require('../../../utils/logger');
const { DEFAULT } = require('./constants');

/**
 * @description Allocate free host ports for the Frigate containers, incrementing from
 * the default ports if they are already taken. Already allocated ports are kept as-is.
 * @param {object} config - Service configuration properties.
 * @returns {Promise} Resolve when all ports are allocated.
 * @example
 * await frigate.allocatePorts(config);
 */
async function allocatePorts(config) {
  const portsToAllocate = [
    { key: 'mqttPort', range: DEFAULT.PORTS.MQTT, label: 'MQTT broker' },
    { key: 'frigateUiPort', range: DEFAULT.PORTS.UI, label: 'Frigate UI' },
    { key: 'frigateApiPort', range: DEFAULT.PORTS.API, label: 'Frigate API' },
    { key: 'frigateRtspPort', range: DEFAULT.PORTS.RTSP, label: 'Frigate RTSP restream' },
  ];

  // eslint-disable-next-line no-restricted-syntax
  for (const { key, range, label } of portsToAllocate) {
    const existingPort = Number(config[key]);
    if (!Number.isNaN(existingPort) && existingPort > 0) {
      config[key] = existingPort;
    } else {
      // eslint-disable-next-line no-await-in-loop
      config[key] = await portfinder.getPortPromise({
        port: range.min,
        stopPort: range.max,
      });
      logger.info(`Frigate: allocated port ${config[key]} for ${label}`);
    }
  }
}

module.exports = {
  allocatePorts,
};
