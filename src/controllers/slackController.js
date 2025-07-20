const { 
  createSession, 
  getLatestSessionForChannel 
} = require('../services/sessionService');

const { 
  saveVote, 
  getSessionVotes 
} = require('../services/voteService');

const { 
  addReaction, 
  sendDelayedResponse,
  createPokerSessionMessage,
  formatPokerResults
} = require('../utils');

/**
 * Handle the /poker slash command
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handlePokerCommand(req, res) {
  try {
    console.log('Received poker command:', JSON.stringify(req.body));
    
    const { text, user_id, channel_id, response_url } = req.body;
    
    // Acknowledge receipt immediately
    res.status(200).send({
      response_type: "ephemeral",
      text: "Processing your request..."
    });
    
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
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error creating session:', error);
      }
      return sendDelayedResponse(response_url, { 
        response_type: "ephemeral",
        text: "Error: Could not create a new planning poker session." 
      });
    }
    
    // Send the response with voting buttons
    return sendDelayedResponse(
      response_url, 
      createPokerSessionMessage(user_id, text, sessionId)
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Exception handling poker command:', err);
    }
    
    // If we have a response_url, use it to send an error message
    if (req.body && req.body.response_url) {
      return sendDelayedResponse(req.body.response_url, { 
        text: "Sorry, there was an error processing your command. Please try again." 
      });
    }
    
    // Fallback if we've already sent the initial response
    return;
  }
}

/**
 * Handle the /poker-reveal slash command
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handlePokerRevealCommand(req, res) {
  try {
    console.log('Received poker-reveal command:', JSON.stringify(req.body));
    
    const { channel_id, response_url } = req.body;
    
    // Acknowledge receipt immediately
    res.status(200).send({
      response_type: "ephemeral",
      text: "Processing your request..."
    });
    
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
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error retrieving votes:', votesError);
      }
      return sendDelayedResponse(response_url, { 
        response_type: "ephemeral",
        text: "Error: Could not retrieve votes for the current session." 
      });
    }
    
    // Format and send the results
    return sendDelayedResponse(
      response_url, 
      formatPokerResults(votes, session.issue)
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Exception handling poker-reveal command:', err);
    }
    
    // If we have a response_url, use it to send an error message
    if (req.body && req.body.response_url) {
      return sendDelayedResponse(req.body.response_url, { 
        text: "Sorry, there was an error processing your command. Please try again." 
      });
    }
    
    // Fallback if we've already sent the initial response
    return;
  }
}

/**
 * Handle Slack interactive actions (button clicks)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleInteractiveActions(req, res) {
  try {
    console.log('Received action request:', JSON.stringify(req.body));
    
    if (!req.body.payload) {
      console.log('Missing payload in request');
      return res.status(200).json({ 
        text: "Error: Missing payload in the request." 
      });
    }
    
    const payload = JSON.parse(req.body.payload);
    
    // Check if this is a button action
    if (payload.type !== 'interactive_message' || !payload.actions || payload.actions.length === 0) {
      return res.status(200).json({ 
        text: "Error: Unsupported action type." 
      });
    }
    
    const action = payload.actions[0];
    
    // Check if this is a vote action
    if (action.name !== 'vote' || !action.value) {
      return res.status(200).json({ 
        text: "Error: Unsupported action." 
      });
    }
    
    // Parse the value
    let voteData;
    try {
      voteData = JSON.parse(action.value);
    } catch (e) {
      return res.status(200).json({ 
        text: "Error: Invalid vote data." 
      });
    }
    
    // Save the vote
    const { success, error } = await saveVote(
      voteData.sessionId, 
      payload.user.id, 
      voteData.vote,
      payload.user.name
    );
    
    if (!success) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error saving vote:', error);
      }
      return res.status(200).json({ 
        text: "Error: Could not save your vote." 
      });
    }
    
    // Add a reaction to the message to indicate a vote was cast
    if (payload.channel && (payload.message_ts || (payload.original_message && payload.original_message.ts))) {
      const timestamp = payload.message_ts || payload.original_message.ts;
      addReaction(payload.channel.id, timestamp, payload.user.id);
    }
    
    // Send a confirmation message visible only to the user
    return res.status(200).json({ 
      response_type: "ephemeral",
      replace_original: false,
      text: `Your vote (${voteData.vote}) has been recorded.` 
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Exception handling interactive action:', err);
    }
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
