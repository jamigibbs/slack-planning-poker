const axios = require('axios');
const voteEmojis = require('./emojiList.json');
const logger = require('./logger');

/**
 * Get a random emoji from the voteEmojis array
 * @returns {string} A random emoji name
 */
function getRandomEmoji() {
  return voteEmojis[Math.floor(Math.random() * voteEmojis.length)];
}

/**
 * Add a reaction emoji to a Slack message
 * @param {string} channel - The channel ID
 * @param {string} timestamp - The message timestamp
 * @param {string} user - The user ID
 * @param {string|null} reaction - Optional specific reaction to add, otherwise random
 * @returns {Promise<Object>} Result of the operation
 */
async function addReaction(channel, timestamp, user, reaction = null, botToken = null) {
  try {
    // Skip if no timestamp provided (can't add reaction without message timestamp)
    if (!timestamp) {
      logger.log('Skipping reaction - no message timestamp provided');
      return { success: false, error: 'No timestamp provided' };
    }
    
    if (!reaction) {
      reaction = getRandomEmoji();
    }
    
    // Use provided bot token or fallback to environment variable
    const token = botToken || process.env.SLACK_BOT_TOKEN;
    
    const response = await axios.post('https://slack.com/api/reactions.add', {
      channel: channel,
      timestamp: timestamp,
      name: reaction
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
    if (!response.data.ok) {
      // Handle specific error cases
      if (response.data.error === 'already_reacted') {
        // Try again with a different emoji
        return addReaction(channel, timestamp, user, getRandomEmoji(), botToken);
      } else if (response.data.error === 'not_in_channel') {
        logger.log(`Bot needs to be invited to channel ${channel}`);
        return { success: false, error: 'Bot not in channel' };
      } else if (response.data.error === 'missing_scope') {
        logger.log('Missing scope for reactions.add. Check bot permissions.');
        return { success: false, error: 'Missing scope' };
      } else {
        logger.log('Error adding reaction:', response.data);
        return { success: false, error: response.data.error };
      }
    }
    
    return { success: true, emoji: reaction };
  } catch (err) {
    logger.error('Exception adding reaction:', err);
    return { success: false, error: err };
  }
}

/**
 * Send a delayed response to a Slack response_url
 * @param {string} responseUrl - The Slack response URL
 * @param {Object} message - The message to send
 * @returns {Promise<boolean>} Success status
 */
async function sendDelayedResponse(responseUrl, message) {
  try {
    await axios.post(responseUrl, message);
    return true;
  } catch (error) {
    logger.error('Error sending delayed response:', error);
    return false;
  }
}

module.exports = {
  voteEmojis,
  getRandomEmoji,
  addReaction,
  sendDelayedResponse
};
