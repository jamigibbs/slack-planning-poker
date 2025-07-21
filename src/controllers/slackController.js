const { 
  createSession, 
  getLatestSessionForChannel 
} = require('../services/sessionService');

const { 
  saveVote, 
  getSessionVotes,
  hasUserVoted 
} = require('../services/voteService');

const { 
  addReaction, 
  sendDelayedResponse,
  createPokerSessionMessage,
  formatPokerResults
} = require('../utils');

const { getBotTokenForTeam } = require('./oauthController');
const logger = require('../utils/logger');
const axios = require('axios'); // Added axios import

/**
 * Get bot token for the current workspace
 * @param {string} teamId - Slack team ID
 * @returns {Promise<string>} Bot token for the workspace
 */
async function getBotToken(teamId) {
  if (!teamId) {
    return process.env.SLACK_BOT_TOKEN; // Fallback to default token
  }
  
  const workspaceToken = await getBotTokenForTeam(teamId);
  return workspaceToken || process.env.SLACK_BOT_TOKEN; // Fallback if not found
}

/**
 * Handle the /poker slash command
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handlePokerCommand(req, res) {
  try {
    logger.log('Received poker command:', JSON.stringify(req.body));
    
    const { text, user_id, channel_id, response_url, team_id } = req.body;
    
    // Get workspace-specific bot token
    const botToken = await getBotToken(team_id);
    
    // Acknowledge receipt immediately
    res.status(200).send();
  
    // For /poker command, text is required
    if (!text) {
      return sendDelayedResponse(response_url, { 
        response_type: "ephemeral",
        text: "Please provide an issue description or link. Usage: `/poker [issue]`" 
      });
    }
    
    // Create a new session
    const { success, sessionId, error } = await createSession(channel_id, text);
    
    if (!success) {
      logger.error('Error creating session:', error);
      return sendDelayedResponse(response_url, { 
        response_type: "ephemeral",
        text: "Error: Could not create a new planning poker session." 
      });
    }
    
    // Send the response with voting buttons
    const message = createPokerSessionMessage(user_id, text, sessionId);
    const delayedSuccess = await sendDelayedResponse(response_url, message);
    
    // Add reaction to indicate session started (using workspace-specific token)
    if (delayedSuccess) {
      await addReaction(channel_id, null, user_id, null, botToken);
    }
    
    return delayedSuccess;
  } catch (err) {
    logger.error('Error in handlePokerCommand:', err);
    
    // If we have a response_url, use it to send an error message
    if (req.body && req.body.response_url) {
      return sendDelayedResponse(req.body.response_url, { 
        response_type: "ephemeral",
        text: "Sorry, there was an error processing your command. Please try again." 
      });
    }
    
    return false;
  }
}

/**
 * Handle the /poker-reveal slash command
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handlePokerRevealCommand(req, res) {
  try {
    logger.log('Received reveal command:', JSON.stringify(req.body));
    
    const { channel_id, response_url, team_id } = req.body;
    
    // Get workspace-specific bot token
    const botToken = await getBotToken(team_id);
    
    // Acknowledge receipt immediately
    res.status(200).send();
    
    // Get the latest session for this channel
    const { success, session, error } = await getLatestSessionForChannel(channel_id);
    
    if (!success || !session) {
      return sendDelayedResponse(response_url, { 
        response_type: "ephemeral",
        text: "No active planning poker session found for this channel." 
      });
    }
    
    // Get votes for the session
    const { success: votesSuccess, votes, error: votesError } = await getSessionVotes(session.id);
    
    if (!votesSuccess) {
      logger.error('Error retrieving votes:', votesError);
      return sendDelayedResponse(response_url, { 
        response_type: "ephemeral",
        text: "Error: Could not retrieve votes for the current session." 
      });
    }
    
    // Format and send the results
    const message = formatPokerResults(votes, session.issue, session.id);
    const delayedSuccess = await sendDelayedResponse(response_url, message);
    
    // Add reaction to indicate session ended (using workspace-specific token)
    if (delayedSuccess) {
      await addReaction(channel_id, null, null, null, botToken);
    }
    
    return delayedSuccess;
  } catch (err) {
    logger.error('Error in handlePokerRevealCommand:', err);
    
    // If we have a response_url, use it to send an error message
    if (req.body && req.body.response_url) {
      return sendDelayedResponse(req.body.response_url, { 
        text: "Sorry, there was an error processing your command. Please try again." 
      });
    }
    
    return false;
  }
}

/**
 * Handle Slack interactive actions (button clicks)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleInteractiveActions(req, res) {
  try {
    logger.log('Interactive action received:', JSON.stringify(req.body));
    
    if (!req.body.payload) {
      logger.log('Missing payload in request');
      return res.status(200).json({ 
        text: "Error: Missing payload in the request." 
      });
    }
    
    const payload = JSON.parse(req.body.payload);
    
    // Extract action data based on payload type
    let voteData;
    let userId;
    let userName;
    let channelId;
    let messageTs;
    let teamId;
    
    if (payload.type === 'interactive_message') {
      // Legacy format
      if (!payload.actions || payload.actions.length === 0) {
        return res.status(200).json({ 
          text: "Error: No actions found in payload." 
        });
      }
      
      const action = payload.actions[0];
      
      // Check if this is a vote action
      if (action.name !== 'vote' || !action.value) {
        return res.status(200).json({ 
          text: "Error: Unsupported action." 
        });
      }
      
      try {
        voteData = JSON.parse(action.value);
      } catch (e) {
        return res.status(200).json({ 
          text: "Error: Invalid vote data." 
        });
      }
      
      userId = payload.user.id;
      userName = payload.user.name;
      channelId = payload.channel?.id;
      messageTs = payload.message_ts || (payload.original_message && payload.original_message.ts);
      teamId = payload.team.id;
    } 
    else if (payload.type === 'block_actions') {
      // Block Kit format
      if (!payload.actions || payload.actions.length === 0) {
        return res.status(200).json({ 
          text: "Error: No actions found in payload." 
        });
      }
      
      const action = payload.actions[0];
      
      // Check if this is a vote action (action_id should start with "vote_")
      if (!action.action_id.startsWith('vote_') || !action.value) {
        return res.status(200).json({ 
          text: "Error: Unsupported action." 
        });
      }
      
      try {
        voteData = JSON.parse(action.value);
      } catch (e) {
        return res.status(200).json({ 
          text: "Error: Invalid vote data." 
        });
      }
      
      userId = payload.user.id;
      userName = payload.user.username || payload.user.name;
      channelId = payload.channel?.id;
      messageTs = payload.message?.ts || payload.container?.message_ts;
      teamId = payload.team.id;
    } 
    else {
      return res.status(200).json({ 
        text: "Error: Unsupported payload type." 
      });
    }
    
    // Check if user has already voted to provide better feedback
    const { success: checkSuccess, hasVoted } = await hasUserVoted(voteData.sessionId, userId);
    
    // Save the vote
    const { success, error } = await saveVote(
      voteData.sessionId, 
      userId, 
      voteData.vote,
      userName
    );
    
    if (!success) {
      logger.error('Error saving vote:', error);
      return res.status(200).json({ 
        text: "Error: Could not save your vote." 
      });
    }
    
    // Add a reaction to the message to indicate a vote was cast
    if (channelId && messageTs) {
      const botToken = await getBotToken(teamId);
      await addReaction(channelId, messageTs, userId, null, botToken);
    }
    
    // Send a confirmation message with appropriate wording
    const voteAction = (checkSuccess && hasVoted) ? 'has been updated' : 'has been recorded';
    return res.status(200).json({ 
      response_type: "ephemeral",
      replace_original: false,
      text: `Your vote (${voteData.vote}) ${voteAction}.` 
    });
  } catch (err) {
    logger.error('Error in handleInteractiveActions:', err);
    return res.status(200).json({ 
      text: "Sorry, there was an error processing your action. Please try again." 
    });
  }
}

module.exports = {
  handlePokerCommand,
  handlePokerRevealCommand,
  handleInteractiveActions
};
