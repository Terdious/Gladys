const { connect } = require('./connect');
const { poll } = require('./poll');
const { setValue } = require('./setValue');
const { publishStatus, getStatus } = require('./status');

module.exports = {
    connect,
    poll,
    setValue,
    publishStatus,
    getStatus,
};
