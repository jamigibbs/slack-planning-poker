const express = require('express');
const router = express.Router();
const path = require('path');

// Import route modules
const slackRoutes = require('./slack');
const oauthRoutes = require('./oauth');

// Root endpoint serves the landing page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Mount routes
router.use('/slack', slackRoutes);
router.use('/slack', oauthRoutes); // OAuth routes under /slack

module.exports = router;
