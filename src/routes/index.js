const express = require('express');
const router = express.Router();
const slackRoutes = require('./slack');
const adminRoutes = require('./admin');

// Root endpoint for health check
router.get('/', (req, res) => {
  res.send('Slack Planning Poker server is running!');
});

// Mount routes
router.use('/slack', slackRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
