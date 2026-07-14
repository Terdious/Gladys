const fse = require('fs-extra');
const Promise = require('bluebird');
const { promises: fs } = require('fs');
const fsWithoutPromise = require('fs');
const EvenEmitter = require('events');
const path = require('path');
const util = require('util');
const randomBytes = util.promisify(require('crypto').randomBytes);
const logger = require('../../../utils/logger');
const { NotFoundError, ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { DEVICE_EXTERNAL_ID_PREFIX, DEFAULT, MODES } = require('./constants');

/**
 * @description Start live streaming a Frigate camera through the go2rtc restream.
 * @param {string} cameraSelector - The camera to stream.
 * @param {boolean} isGladysGateway - If the stream starts from Gladys Gateway or local.
 * @param {number} segmentDuration - The duration of one segment in seconds.
 * @returns {Promise} Resolve when stream started.
 * @example
 * startStreaming('my-camera', false, 1);
 */
async function startStreaming(cameraSelector, isGladysGateway, segmentDuration = 1) {
  // If stream already exist, return existing stream
  if (this.liveStreams.has(cameraSelector)) {
    const liveStream = this.liveStreams.get(cameraSelector);
    // If we are in a local stream, and new request come from Gladys Plus
    if (liveStream.isGladysGateway === false && isGladysGateway === true) {
      await this.convertLocalStreamToGateway(cameraSelector);
    }
    return {
      camera_folder: liveStream.cameraFolder,
      encryption_key: liveStream.encryptionKey,
    };
  }
  // Init the stream object
  this.liveStreams.set(cameraSelector, {
    isGladysGateway,
  });

  try {
    // The go2rtc restream of a remote instance is bound to its localhost:
    // live streaming needs the local installation (v1 limitation)
    if (this.mode === MODES.REMOTE) {
      throw new ServiceNotConfiguredError('FRIGATE_REMOTE_LIVE_NOT_SUPPORTED');
    }
    if (!this.frigateRtspPort) {
      throw new ServiceNotConfiguredError('FRIGATE_RTSP_PORT_NOT_ALLOCATED');
    }
    const device = await this.gladys.device.getBySelector(cameraSelector);
    const [externalIdPrefix, cameraName] = (device.external_id || '').split(':');
    if (externalIdPrefix !== DEVICE_EXTERNAL_ID_PREFIX || !cameraName) {
      throw new NotFoundError('CAMERA_NOT_MANAGED_BY_FRIGATE');
    }
    // we create a temp folder
    const now = new Date();
    const cameraFolder = `camera-${device.id}-${now.getSeconds()}-${now.getMinutes()}-${now.getHours()}`;
    const folderPath = path.join(this.gladys.config.tempFolder, cameraFolder);
    await fse.ensureDir(folderPath);
    const indexFilePath = path.join(folderPath, 'index.m3u8');
    // We create an encryption key
    const encryptionKey = (await randomBytes(16)).toString('hex');
    // The "BACKEND_URL_TO_REPLACE" will be replaced by the client with his API URL.
    // On the Gateway side, it'll be replaced by the Gateway server url
    const encryptionKeyUrl = `BACKEND_URL_TO_REPLACE/api/v1/service/frigate/camera/streaming/${cameraFolder}/index.m3u8.key`;
    const keyInfoFilePath = path.join(folderPath, 'key_info_file.txt');
    const encryptionKeyFilePath = path.join(folderPath, 'index.m3u8.key');

    const streamingReadyEvent = new EvenEmitter();
    const watchAbortController = new AbortController();
    const sharedObjectToVerify = {};

    // We watch the folder to upload any change to Gladys Plus
    fsWithoutPromise.watch(
      folderPath,
      {
        signal: watchAbortController.signal,
      },
      (eventType, filename) => {
        logger.debug(`New camera file ${filename}`);
        // if it's the first time that the index file is seen
        // We throw an event to signify that index exist
        if (filename === 'index.m3u8' && !sharedObjectToVerify.indexExist) {
          sharedObjectToVerify.indexExist = true;
          streamingReadyEvent.emit('index-ready');
        }
        this.onNewCameraFile(
          cameraSelector,
          folderPath,
          cameraFolder,
          filename,
          sharedObjectToVerify,
          streamingReadyEvent,
        );
      },
    );

    await Promise.all([
      fs.writeFile(keyInfoFilePath, `${encryptionKeyUrl}\n${encryptionKeyFilePath}`),
      fs.writeFile(encryptionKeyFilePath, encryptionKey),
    ]);

    // The video is stream-copied from the go2rtc restream (no transcoding),
    // only the audio is converted to AAC for HLS compatibility
    const args = [
      ...DEFAULT.LIVE_INPUT_ARGS,
      '-i',
      `rtsp://127.0.0.1:${this.frigateRtspPort}/${cameraName}`,
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      DEFAULT.LIVE_AUDIO_BITRATE,
      '-ac',
      '2', // Audio channels, 2 = stereo
      '-sn', // No subtitle stream
      '-dn', // No data stream
      '-avoid_negative_ts',
      'make_zero',
      '-hls_time',
      segmentDuration.toString(),
      '-hls_list_size',
      DEFAULT.LIVE_HLS_LIST_SIZE.toString(),
      '-hls_enc',
      '1',
      '-hls_enc_key',
      encryptionKey,
      '-hls_key_info_file',
      keyInfoFilePath,
      indexFilePath,
    ];

    const options = {
      timeout: 5 * 60 * 1000, // 5 minutes
    };

    const liveStreamingProcess = this.childProcess.spawn('ffmpeg', args, options);

    this.liveStreams.set(cameraSelector, {
      liveStreamingProcess,
      cameraFolder,
      encryptionKey,
      watchAbortController,
      fullFolderPath: folderPath,
      isGladysGateway,
    });

    liveStreamingProcess.stdout.on('data', (data) => {
      logger.debug(`stdout: ${data}`);
    });

    liveStreamingProcess.stderr.on('data', (data) => {
      logger.debug(`stderr: ${data}`);
    });

    liveStreamingProcess.on('close', (code) => {
      logger.debug(`child process exited with code ${code}`);
      streamingReadyEvent.emit('init-error', new Error(`Child process exited with code ${code}`));
      this.stopStreaming(cameraSelector);
    });

    // Every X seconds, we verify if the live is active
    // If not, we stop the live to avoid wasting ressources
    if (!this.checkIfLiveActiveInterval) {
      this.checkIfLiveActiveInterval = setInterval(
        this.checkIfLiveActive.bind(this),
        this.checkIfLiveActiveFrequencyInSeconds * 1000,
      );
    }

    return new Promise((resolve, reject) => {
      let alreadyResolved = false;
      streamingReadyEvent.on('index-ready', () => {
        if (!isGladysGateway && !alreadyResolved) {
          alreadyResolved = true;
          resolve({
            camera_folder: cameraFolder,
            encryption_key: encryptionKey,
          });
        }
      });
      // If there was an error during start, and we haven't resolved
      streamingReadyEvent.on('init-error', (e) => {
        if (!alreadyResolved) {
          alreadyResolved = true;
          reject(e);
        }
      });
      streamingReadyEvent.on('gateway-ready', () => {
        if (!alreadyResolved) {
          alreadyResolved = true;
          resolve({
            camera_folder: cameraFolder,
            encryption_key: encryptionKey,
          });
        }
      });
    });
  } catch (e) {
    this.liveStreams.delete(cameraSelector);
    throw e;
  }
}

module.exports = {
  startStreaming,
};
