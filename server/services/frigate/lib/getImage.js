const axios = require('axios');

const { NotFoundError, BadParameters } = require('../../../utils/coreErrors');
const { DEFAULT, DEVICE_EXTERNAL_ID_PREFIX, MODES } = require('./constants');

// Same limit as the core camera.setImage (150 Ko of base64 characters)
const MAX_SIZE_IMAGE = 150 * 1024;

/**
 * @description Get the latest camera image from the Frigate API.
 * @param {object} device - The camera device.
 * @returns {Promise<string>} Resolve with the image in base64.
 * @example
 * const image = await frigate.getImage(device);
 */
async function getImage(device) {
  const [prefix, cameraName] = (device.external_id || '').split(':');
  if (prefix !== DEVICE_EXTERNAL_ID_PREFIX || !cameraName) {
    throw new BadParameters(`Frigate: device ${device.external_id} has an invalid external id`);
  }
  const imagePath = `/api/${cameraName}/latest.webp?height=${DEFAULT.IMAGE_HEIGHT}`;
  let data;
  let headers;
  if (this.mode === MODES.REMOTE) {
    // Remote instance: authenticated UI port
    ({ data, headers } = await this.remoteApiGet(imagePath, { responseType: 'arraybuffer' }));
  } else {
    if (!this.frigateApiPort) {
      throw new NotFoundError('Frigate: API port is not allocated yet');
    }
    ({ data, headers } = await axios.get(`http://127.0.0.1:${this.frigateApiPort}${imagePath}`, {
      responseType: 'arraybuffer',
    }));
  }

  const contentType = headers['content-type'] || 'image/webp';
  const image = `${contentType};base64,${Buffer.from(data).toString('base64')}`;
  if (image.length > MAX_SIZE_IMAGE) {
    throw new BadParameters(`Frigate: image of camera ${cameraName} is too big`);
  }

  return image;
}

module.exports = {
  getImage,
};
