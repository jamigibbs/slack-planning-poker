const express = require('express');
const router = express.Router();
const { 
  handleAdminCleanupPost, 
  handleAdminCleanupGet 
} = require('../controllers/adminController');

// Admin cleanup endpoint - POST method
router.post('/cleanup', handleAdminCleanupPost);

// Admin cleanup endpoint - GET method (for browser access)
router.get('/cleanup', handleAdminCleanupGet);

module.exports = router;
