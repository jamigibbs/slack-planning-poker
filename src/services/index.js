// Export all services
const sessionService = require('./sessionService');
const voteService = require('./voteService');

module.exports = {
  ...sessionService,
  ...voteService
};
