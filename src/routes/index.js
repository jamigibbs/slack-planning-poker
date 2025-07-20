const express = require('express');
const router = express.Router();

// Import route modules
const slackRoutes = require('./slack');
const adminRoutes = require('./admin');
const oauthRoutes = require('./oauth');

// Root endpoint for health check
router.get('/', (req, res) => {
  res.send('Slack Planning Poker server is running!');
});

// Mount routes
router.use('/slack', slackRoutes);
router.use('/admin', adminRoutes);
router.use('/', oauthRoutes); // OAuth routes at root level

module.exports = router;
