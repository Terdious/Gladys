const { expect } = require('chai');

const { buildCameraConfig, getDeviceParam } = require('../../../../services/frigate/lib/buildCameraConfig');

const buildDevice = (params) => ({
  external_id: 'frigate:c660',
  params: Object.keys(params).map((name) => ({ name, value: params[name] })),
});

describe('frigate buildCameraConfig', () => {
  it('should return a device param', () => {
    const device = buildDevice({ FRIGATE_SOURCE_TYPE: 'rtsp' });
    expect(getDeviceParam(device, 'FRIGATE_SOURCE_TYPE')).to.equal('rtsp');
    expect(getDeviceParam(device, 'UNKNOWN')).to.equal(null);
    expect(getDeviceParam({ external_id: 'frigate:x' }, 'UNKNOWN')).to.equal(null);
  });

  it('should build a full rtsp source with encoded credentials', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_SOURCE_USERNAME: 'user@home',
      FRIGATE_SOURCE_PASSWORD: 'p^ss#word',
      FRIGATE_SOURCE_PATH: '/stream1',
      FRIGATE_TRACKED_LABELS: 'person,dog',
      FRIGATE_DETECT_FPS: '10',
    });

    const { cameraName, go2rtcSource, cameraSection } = buildCameraConfig(device);

    expect(cameraName).to.equal('c660');
    expect(go2rtcSource).to.equal('rtsp://user%40home:p%5Ess%23word@192.168.1.10:554/stream1');
    expect(cameraSection.ffmpeg.inputs).to.deep.equal([
      {
        path: 'rtsp://127.0.0.1:8554/c660',
        roles: ['detect', 'record'],
      },
    ]);
    expect(cameraSection.detect).to.deep.equal({ enabled: true, fps: 10 });
    expect(cameraSection.objects.track).to.deep.equal(['person', 'dog']);
    expect(cameraSection.record.enabled).to.equal(true);
    expect(cameraSection.record.continuous.days).to.equal(2);
    expect(cameraSection.snapshots.enabled).to.equal(true);
    // Per-label MQTT snapshots: cropped and small enough for the Gladys image limit
    expect(cameraSection.mqtt).to.deep.equal({
      enabled: true,
      timestamp: false,
      bounding_box: true,
      crop: true,
      height: 270,
      quality: 70,
    });
  });

  it('should build a rtsp source without credentials nor path', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('rtsp://192.168.1.10:554');
  });

  it('should build a rtsp source with username but no password', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_SOURCE_USERNAME: 'admin',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('rtsp://admin:@192.168.1.10:554');
  });

  it('should build a tapo source without password', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'tapo',
      FRIGATE_SOURCE_HOST: '10.6.0.222',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('tapo://@10.6.0.222?channel=0&subtype=1');
  });

  it('should normalize a rtsp path without leading slash', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_SOURCE_PATH: 'stream2',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('rtsp://192.168.1.10:554/stream2');
  });

  it('should throw when rtsp host is missing', () => {
    const device = buildDevice({ FRIGATE_SOURCE_TYPE: 'rtsp' });
    expect(() => buildCameraConfig(device)).to.throw('has no host configured');
  });

  it('should build a tapo source with encoded password, default extra and wallclock input args', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'tapo',
      FRIGATE_SOURCE_HOST: '10.6.0.222',
      FRIGATE_SOURCE_PASSWORD: 'p^ss#word',
    });

    const { go2rtcSource, cameraSection } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('tapo://p%5Ess%23word@10.6.0.222?channel=0&subtype=1');
    expect(cameraSection.ffmpeg.inputs[0].input_args).to.equal(
      '-avoid_negative_ts make_zero -fflags +genpts+discardcorrupt -rtsp_transport tcp -use_wallclock_as_timestamps 1',
    );
    expect(cameraSection.detect).to.deep.equal({ enabled: true, fps: 5, width: 640, height: 360 });
  });

  it('should build a tapo source with custom extra', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'tapo',
      FRIGATE_SOURCE_HOST: '10.6.0.222',
      FRIGATE_SOURCE_PASSWORD: 'password',
      FRIGATE_SOURCE_EXTRA: 'channel=0&subtype=0',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('tapo://password@10.6.0.222?channel=0&subtype=0');
  });

  it('should throw when tapo host is missing', () => {
    const device = buildDevice({ FRIGATE_SOURCE_TYPE: 'tapo' });
    expect(() => buildCameraConfig(device)).to.throw('has no host configured');
  });

  it('should build a tapo source with the admin sha256 variant', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'tapo',
      FRIGATE_SOURCE_HOST: '10.6.0.222',
      FRIGATE_SOURCE_PASSWORD: 'password',
      FRIGATE_TAPO_AUTH_VARIANT: 'sha256',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal(
      'tapo://admin:5E884898DA28047151D0E56F8DC6292773603D0D6AABBDD62A11EF721D1542D8@10.6.0.222?channel=0&subtype=1',
    );
  });

  it('should build an onvif source with encoded credentials and catalog port', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'onvif',
      FRIGATE_SOURCE_HOST: '192.168.1.30',
      FRIGATE_CAMERA_ONVIF_PORT: '2020',
      FRIGATE_ONVIF_USERNAME: 'admin',
      FRIGATE_ONVIF_PASSWORD: 'p#ss',
    });

    const { go2rtcSource, go2rtcSubSource, cameraSection } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('onvif://admin:p%23ss@192.168.1.30:2020');
    expect(go2rtcSubSource).to.equal(null);
    expect(cameraSection.ffmpeg.inputs[0].input_args).to.equal(undefined);
  });

  it('should build a rtsp source with a custom port', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_CAMERA_RTSP_PORT: '8554',
      FRIGATE_SOURCE_PATH: 'stream1',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('rtsp://192.168.1.10:8554/stream1');
  });

  it('should build a tapo sha256 source without password', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'tapo',
      FRIGATE_SOURCE_HOST: '10.6.0.222',
      FRIGATE_TAPO_AUTH_VARIANT: 'sha256',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.contain('tapo://admin:E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855');
  });

  it('should build an onvif source with username but no password', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'onvif',
      FRIGATE_SOURCE_HOST: '192.168.1.30',
      FRIGATE_ONVIF_USERNAME: 'admin',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('onvif://admin:@192.168.1.30:80');
  });

  it('should build an onvif source without credentials on the default port', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'onvif',
      FRIGATE_SOURCE_HOST: '192.168.1.30',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('onvif://192.168.1.30:80');
  });

  it('should throw when onvif host is missing', () => {
    const device = buildDevice({ FRIGATE_SOURCE_TYPE: 'onvif' });
    expect(() => buildCameraConfig(device)).to.throw('has no host configured');
  });

  it('should build a custom go2rtc source', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'custom',
      FRIGATE_CUSTOM_SOURCE: 'ffmpeg:http://192.168.1.20/flv?stream=main#video=copy',
    });

    const { go2rtcSource, cameraSection } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('ffmpeg:http://192.168.1.20/flv?stream=main#video=copy');
    expect(cameraSection.ffmpeg.inputs[0].input_args).to.equal(undefined);
  });

  it('should throw when custom source is missing', () => {
    const device = buildDevice({ FRIGATE_SOURCE_TYPE: 'custom' });
    expect(() => buildCameraConfig(device)).to.throw('has no custom source configured');
  });

  it('should throw on invalid source type', () => {
    const device = buildDevice({ FRIGATE_SOURCE_TYPE: 'webcam' });
    expect(() => buildCameraConfig(device)).to.throw('invalid source type');
  });

  it('should throw on invalid external id', () => {
    const device = { external_id: 'frigate', params: [] };
    expect(() => buildCameraConfig(device)).to.throw('invalid external id');
  });

  it('should split record and detect roles when a rtsp sub stream is set', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_SOURCE_USERNAME: 'camera',
      FRIGATE_SOURCE_PASSWORD: 'password',
      FRIGATE_SOURCE_PATH: 'stream1',
      FRIGATE_SOURCE_SUB_PATH: 'stream2',
    });

    const { go2rtcSource, go2rtcSubSource, cameraSection } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('rtsp://camera:password@192.168.1.10:554/stream1');
    expect(go2rtcSubSource).to.equal('rtsp://camera:password@192.168.1.10:554/stream2');
    expect(cameraSection.ffmpeg.inputs).to.deep.equal([
      {
        path: 'rtsp://127.0.0.1:8554/c660',
        roles: ['record'],
      },
      {
        path: 'rtsp://127.0.0.1:8554/c660_sub',
        roles: ['detect'],
      },
    ]);
  });

  it('should return no sub source for rtsp without sub path', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
    });

    const { go2rtcSubSource } = buildCameraConfig(device);

    expect(go2rtcSubSource).to.equal(null);
  });

  it('should use the custom secondary source for detection', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'custom',
      FRIGATE_CUSTOM_SOURCE: 'ffmpeg:http://192.168.1.20/flv?stream=main#video=copy',
      FRIGATE_CUSTOM_SUB_SOURCE: 'ffmpeg:http://192.168.1.20/flv?stream=ext',
    });

    const { go2rtcSubSource, cameraSection } = buildCameraConfig(device);

    expect(go2rtcSubSource).to.equal('ffmpeg:http://192.168.1.20/flv?stream=ext');
    expect(cameraSection.ffmpeg.inputs[1]).to.deep.equal({
      path: 'rtsp://127.0.0.1:8554/c660_sub',
      roles: ['detect'],
    });
  });

  it('should never return a sub source for tapo', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'tapo',
      FRIGATE_SOURCE_HOST: '10.6.0.222',
      FRIGATE_SOURCE_PASSWORD: 'password',
    });

    const { go2rtcSubSource } = buildCameraConfig(device);

    expect(go2rtcSubSource).to.equal(null);
  });

  it('should default to person label and default fps when values are invalid', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_TRACKED_LABELS: 'unicorn, dragon',
      FRIGATE_DETECT_FPS: 'abc',
    });

    const { cameraSection } = buildCameraConfig(device);

    expect(cameraSection.objects.track).to.deep.equal(['person']);
    expect(cameraSection.detect.fps).to.equal(5);
  });

  it('should build a mjpeg source re-encoded to h264', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'mjpeg',
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_SOURCE_USERNAME: 'user@home',
      FRIGATE_SOURCE_PASSWORD: 'p#ss',
    });

    const { go2rtcSource, go2rtcSubSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('ffmpeg:http://user%40home:p%23ss@10.6.0.1:80/video.cgi#video=h264');
    expect(go2rtcSubSource).to.equal(null);
  });

  it('should build a mjpeg source with a custom port and path', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'mjpeg',
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_CAMERA_HTTP_PORT: '8080',
      FRIGATE_SOURCE_PATH: '/mjpeg.cgi',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('ffmpeg:http://10.6.0.1:8080/mjpeg.cgi#video=h264');
  });

  it('should build a mjpeg source with username but no password', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'mjpeg',
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_SOURCE_USERNAME: 'admin',
    });

    const { go2rtcSource } = buildCameraConfig(device);

    expect(go2rtcSource).to.equal('ffmpeg:http://admin:@10.6.0.1:80/video.cgi#video=h264');
  });

  it('should throw when mjpeg host is missing', () => {
    const device = buildDevice({ FRIGATE_SOURCE_TYPE: 'mjpeg' });
    expect(() => buildCameraConfig(device)).to.throw('has no host configured');
  });

  it('should not declare the onvif section for a proprietary control protocol', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'mjpeg',
      FRIGATE_SOURCE_HOST: '10.6.0.1',
      FRIGATE_PTZ_PROTOCOL: 'dlink-http',
      FRIGATE_ONVIF_USERNAME: 'admin',
      FRIGATE_ONVIF_PASSWORD: 'admin-password',
    });

    const { cameraSection } = buildCameraConfig(device);

    expect(cameraSection.onvif).to.equal(undefined);
  });

  it('should declare the camera onvif section when ONVIF credentials are set', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_CAMERA_ONVIF_PORT: '2020',
      FRIGATE_ONVIF_USERNAME: 'onvif-user',
      FRIGATE_ONVIF_PASSWORD: 'onvif-password',
    });

    const { cameraSection } = buildCameraConfig(device);

    expect(cameraSection.onvif).to.deep.equal({
      host: '192.168.1.10',
      port: 2020,
      user: 'onvif-user',
      password: 'onvif-password',
    });
  });

  it('should declare the camera onvif section on the default port', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_ONVIF_USERNAME: 'onvif-user',
      FRIGATE_ONVIF_PASSWORD: 'onvif-password',
    });

    const { cameraSection } = buildCameraConfig(device);

    expect(cameraSection.onvif.port).to.equal(80);
  });

  it('should not declare the camera onvif section without credentials', () => {
    const device = buildDevice({
      FRIGATE_SOURCE_TYPE: 'rtsp',
      FRIGATE_SOURCE_HOST: '192.168.1.10',
      FRIGATE_ONVIF_USERNAME: 'onvif-user',
    });

    const { cameraSection } = buildCameraConfig(device);

    expect(cameraSection.onvif).to.equal(undefined);
  });
});
