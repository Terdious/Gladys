const express = require('express');
const http = require('http');
const compression = require('compression');
const WebSocket = require('ws');
const path = require('path');
const i18n = require('i18n');
const constants = require('../utils/constants');
const errorMiddleware = require('./middlewares/errorMiddleware');
const notFoundMiddleware = require('./middlewares/notFoundMiddleware');
const WebsocketManager = require('./websockets');
const logger = require('../utils/logger');
const { setupRoutes } = require('./setupRoutes');

const STATIC_FOLDER = path.join(__dirname, '/../static');

/**
 * @description Start Gladys server
 * @param {Object} gladys - Gladys library.
 * @param {number} port - Server port to listen to.
 * @param {Object} options - Options to start the server.
 * @example
 * server.start(gladys, 1337);
 */
async function start(gladys, port, options) {
  const app = express();

  // compress all response
  app.use(compression());

  // parse json
  app.use(express.json());

  if (options.serveFront) {
    // serving static app
    app.use(express.static(STATIC_FOLDER));
  }

  // loading app
  app.use(setupRoutes(gladys));

  i18n.configure({
    locales: [constants.AVAILABLE_LANGUAGES.FR, constants.AVAILABLE_LANGUAGES.EN],
    register: global,
    directory: path.join(__dirname, '../config/i18n'),
    defaultLocale: 'en',
    objectNotation: true,
    updateFiles: false,
  });

  const user = await gladys.user.get({ order_dir: 'ASC', order_by: 'created_at', take: 1 });
  if (user) {
    const userLanguage = user[0].language;
    i18n.setLocale(userLanguage);
  }

  app.use(i18n.init);

  // if not API routes was found
  app.use('/api', notFoundMiddleware);

  if (options.serveFront) {
    // handle every other route with index.html
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(STATIC_FOLDER, 'index.html'));
    });
  }

  // loading error middleware
  app.use(errorMiddleware);

  // initialize a simple http server
  const server = http.createServer(app);

  // initialize the WebSocket server instance
  const wss = new WebSocket.Server({ server });

  // load the websocket server
  const websocketManager = new WebsocketManager(wss, gladys);
  websocketManager.init();

  server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
  });

  return { app, server };
}

module.exports = {
  start,
};
