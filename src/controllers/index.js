// Export controllers
const slackController = require('./slackController');
const adminController = require('./adminController');

module.exports = {
  ...slackController,
  ...adminController
};
