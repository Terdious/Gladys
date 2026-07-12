/**
 * @description Get Docker containers matching exactly the given name.
 * Docker name filters match substrings ('gladys-frigate' would also match
 * 'gladys-frigate-mqtt'), so results are filtered on the exact name.
 * @param {string} containerName - Exact container name.
 * @returns {Promise<Array>} Resolve with the list of matching containers.
 * @example
 * const [container] = await frigate.getDockerContainer('gladys-frigate');
 */
async function getDockerContainer(containerName) {
  const containers = await this.gladys.system.getContainers({
    all: true,
    filters: { name: [containerName] },
  });
  return containers.filter((container) => container.name === `/${containerName}`);
}

module.exports = {
  getDockerContainer,
};
