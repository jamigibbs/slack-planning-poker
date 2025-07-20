const { cleanupOldSessions } = require('../services/sessionService');
const { generateCleanupHtmlResponse } = require('../utils/responseFormatters');

/**
 * Handle admin cleanup request (POST)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleAdminCleanupPost(req, res) {
  try {
    // Check authentication
    if (!req.body.key || req.body.key !== process.env.ADMIN_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid key'
      });
    }
    
    // Get days parameter or use default
    const days = req.body.days ? parseInt(req.body.days, 10) : 30;
    
    if (isNaN(days) || days <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid days parameter'
      });
    }
    
    // Perform cleanup
    const result = await cleanupOldSessions(days);
    
    return res.status(result.success ? 200 : 500).json(result);
  } catch (err) {
    console.error('Exception handling admin cleanup:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
}

/**
 * Handle admin cleanup request (GET)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleAdminCleanupGet(req, res) {
  try {
    // Check authentication
    if (!req.query.key || req.query.key !== process.env.ADMIN_KEY) {
      return res.status(401).send('Unauthorized: Invalid key');
    }
    
    // Get days parameter or use default
    const days = req.query.days ? parseInt(req.query.days, 10) : 30;
    
    if (isNaN(days) || days <= 0) {
      return res.status(400).send('Invalid days parameter');
    }
    
    // Perform cleanup
    const result = await cleanupOldSessions(days);
    
    // Return HTML response for browser
    res.send(generateCleanupHtmlResponse(result));
  } catch (err) {
    console.error('Exception handling admin cleanup:', err);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>${err.message || 'Internal server error'}</p>
        </body>
      </html>
    `);
  }
}

module.exports = {
  handleAdminCleanupPost,
  handleAdminCleanupGet
};
