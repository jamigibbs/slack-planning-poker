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
 * Get user profile information including profile image
 * @param {string} userId - The user ID
 * @param {string} botToken - The bot token
 * @returns {Promise<Object>} User profile data
 */
async function getUserProfile(userId, botToken) {
  try {
    const response = await axios.get('https://slack.com/api/users.profile.get', {
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      params: {
        user: userId
      }
    });
    
    if (response.data.ok) {
      return {
        success: true,
        profile: {
          image_32: response.data.profile.image_32,
          image_48: response.data.profile.image_48,
          display_name: response.data.profile.display_name || response.data.profile.real_name,
          real_name: response.data.profile.real_name
        }
      };
    } else {
      logger.log('Error fetching user profile:', response.data.error);
      return { success: false, error: response.data.error };
    }
  } catch (error) {
    logger.error('Error in getUserProfile:', error);
    return { success: false, error: error.message };
  }
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

/**
 * Update the voting message to show voter profile images
 * @param {string} channel - The channel ID
 * @param {string} timestamp - The message timestamp
 * @param {Array} voters - Array of voter objects with user info
 * @param {string} originalMessage - The original message object
 * @param {string} botToken - The bot token
 * @returns {Promise<Object>} Result of the operation
 */
async function updateVotingMessageWithVoters(channel, timestamp, voters, originalMessage, botToken) {
  try {
    // Fetch profile images for all voters
    const voterProfiles = await Promise.all(
      voters.map(async (voter) => {
        const profileResult = await getUserProfile(voter.user_id, botToken);
        return {
          user_id: voter.user_id,
          username: voter.username,
          vote: voter.vote,
          profile_image: profileResult.success ? profileResult.profile.image_32 : null,
          display_name: profileResult.success ? profileResult.profile.display_name : voter.username
        };
      })
    );

    // Create voter gallery elements
    const voterElements = [];
    
    // Add "Voted:" text
    if (voterProfiles.length > 0) {
      voterElements.push({
        type: "mrkdwn",
        text: `*Voted (${voterProfiles.length}):*`
      });
      
      // Add profile images
      voterProfiles.forEach(voter => {
        if (voter.profile_image) {
          voterElements.push({
            type: "image",
            image_url: voter.profile_image,
            alt_text: voter.display_name || voter.username
          });
        }
      });
    }

    // Create updated message with voter gallery
    const updatedMessage = {
      ...originalMessage,
      blocks: [
        ...(originalMessage.blocks || []),
        {
          type: "context",
          elements: voterElements.length > 0 ? voterElements : [
            {
              type: "mrkdwn",
              text: "_No votes yet_"
            }
          ]
        }
      ]
    };

    // Update the message
    const response = await axios.post('https://slack.com/api/chat.update', {
      channel: channel,
      ts: timestamp,
      ...updatedMessage
    }, {
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });

    if (response.data.ok) {
      logger.log('Successfully updated voting message with voter profiles');
      return { success: true };
    } else {
      logger.log('Error updating voting message:', response.data.error);
      return { success: false, error: response.data.error };
    }
  } catch (error) {
    logger.error('Error in updateVotingMessageWithVoters:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  voteEmojis,
  getRandomEmoji,
  getUserProfile,
  addReaction,
  sendDelayedResponse,
  updateVotingMessageWithVoters
};
