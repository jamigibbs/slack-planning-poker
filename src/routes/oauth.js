const express = require('express');
const router = express.Router();
const { 
  initiateOAuth, 
  handleOAuthCallback, 
  oauthSuccess 
} = require('../controllers/oauthController');

// OAuth flow routes
router.get('/install', initiateOAuth);
router.get('/oauth/callback', handleOAuthCallback);
router.get('/oauth/success', oauthSuccess);

module.exports = router;
