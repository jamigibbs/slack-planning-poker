/**
 * Slack Planning Poker
 * Main entry point for the application
 */

const app = require('./src/app');

// Set port
const port = process.env.PORT || 3000;

// Start server
app.listen(port, () => {
  console.log(`Slack Planning Poker server running on port ${port}`);
});
