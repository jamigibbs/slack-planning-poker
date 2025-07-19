// Required packages
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load env vars from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Track the latest session ID per channel
const latestSessionPerChannel = {};

// Array of suitable emoji reactions for voting
const voteEmojis = [
  'white_check_mark', 'eyes', 'thinking_face', 'raised_hand', 
  'bulb', 'rocket', 'star', 'tada', 'ballot_box_with_check',
  'heavy_check_mark', 'thumbsup', 'raised_hands', 'clap', 'muscle',
  'sunglasses', 'nerd_face', 'robot_face', 'zap', 'fire', 
  'bug', 'the_horns', 'brain', 'cat', 'robot_face'
];

// Express middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Add a verification endpoint to test if the server is running
app.get('/', (req, res) => {
  res.send('Slack Planning Poker server is running!');
});

// Add a verification endpoint for Slack
app.post('/slack/verify', (req, res) => {
  console.log('Received verification request:', req.body);
  res.status(200).json({ text: "Verification successful!" });
});

// Add endpoints to manually trigger cleanup (protected by a secret key)
// Support both POST with JSON body and GET with query parameters for browser access

// POST endpoint for programmatic access
app.post('/admin/cleanup', async (req, res) => {
  // Simple security check - require a secret key
  const { key, days } = req.body;
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  // Run the cleanup with optional days parameter
  const daysToKeep = days ? parseInt(days, 10) : 30;
  const result = await cleanupOldSessions(daysToKeep);
  
  res.status(200).json(result);
});

// GET endpoint for browser access
app.get('/admin/cleanup', async (req, res) => {
  // Simple security check - require a secret key
  const { key, days } = req.query;
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  // Run the cleanup with optional days parameter
  const daysToKeep = days ? parseInt(days, 10) : 30;
  const result = await cleanupOldSessions(daysToKeep);
  
  // Return a more browser-friendly response
  res.send(`
    <html>
      <head>
        <title>Database Cleanup Results</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .success { color: green; }
          .error { color: red; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>Database Cleanup Results</h1>
        <div class="${result.success ? 'success' : 'error'}">
          <h2>${result.success ? 'Success!' : 'Error'}</h2>
          ${result.success 
            ? `<p>Successfully cleaned up:</p>
               <ul>
                 <li><strong>${result.deletedSessions}</strong> old sessions</li>
                 <li><strong>${result.deletedVotes}</strong> associated votes</li>
               </ul>` 
            : `<p>Error: ${result.error}</p>`
          }
        </div>
        <h3>Full Response:</h3>
        <pre>${JSON.stringify(result, null, 2)}</pre>
      </body>
    </html>
  `);
});

/**
 * UTILITY FUNCTIONS
 */

// Save a vote to the database
async function saveVote(sessionId, userId, vote, username) {
  try {
    // Use upsert operation with on_conflict to update existing votes
    const { error } = await supabase
      .from('votes')
      .upsert({ 
        session_id: sessionId, 
        user_id: userId, 
        vote: vote,
        username: username
      }, {
        onConflict: 'session_id,user_id',
        returning: 'minimal'
      });
    if (error) {
      console.error('Error saving vote:', error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error('Exception saving vote:', err);
    return { success: false, error: err };
  }
}

// Get the latest session for a channel
async function getLatestSessionForChannel(channelId) {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('channel', channelId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error fetching latest session:', error);
      return { success: false, error, session: null };
    }
    
    if (!data || data.length === 0) {
      return { success: true, session: null };
    }
    
    return { success: true, session: data[0] };
  } catch (err) {
    console.error('Exception fetching latest session:', err);
    return { success: false, error: err, session: null };
  }
}

// Get all votes for a session
async function getSessionVotes(sessionId) {
  try {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error fetching votes:', error);
      return { success: false, error, votes: null };
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .limit(1);
    
    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return { success: false, error: sessionError, session: null, votes: null };
    }
    
    if (!sessionData || sessionData.length === 0) {
      return { success: true, session: null, votes: data };
    }
    
    return { success: true, session: sessionData[0], votes: data };
  } catch (err) {
    console.error('Exception fetching votes:', err);
    return { success: false, error: err, session: null, votes: null };
  }
}

// Get a random emoji from the array
function getRandomEmoji() {
  const randomIndex = Math.floor(Math.random() * voteEmojis.length);
  return voteEmojis[randomIndex];
}

// Add a reaction to a message
async function addReaction(channel, timestamp, user, reaction = null) {
  try {
    // If no specific reaction is provided, get a random one
    if (!reaction) {
      reaction = getRandomEmoji();
    }
    
    console.log(`Adding ${reaction} reaction to message in channel ${channel} at timestamp ${timestamp}`);
    
    // Important: We need to use the bot token to add reactions, not as the user
    // The user parameter is not used in the API call as the bot adds the reaction
    const response = await axios.post('https://slack.com/api/reactions.add', {
      channel: channel,
      timestamp: timestamp,
      name: reaction
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.data.ok) {
      console.error('Error adding reaction:', response.data.error);
      
      // Handle specific error cases
      if (response.data.error === 'not_in_channel') {
        console.log(`Bot needs to be invited to channel ${channel}. Use /invite @YourBotName in the channel.`);
      } else if (response.data.error === 'missing_scope') {
        console.log('Bot token is missing reactions:write scope. Update app permissions in Slack API dashboard.');
      } else if (response.data.error === 'already_reacted') {
        // If this emoji is already used, try another random one
        console.log('Already used this emoji, trying another one');
        // Try again with a different emoji
        const newEmoji = getRandomEmoji();
        if (newEmoji !== reaction) {
          return addReaction(channel, timestamp, user, newEmoji);
        } else {
          console.log('Already reacted with all available emojis');
          return { success: true, alreadyReacted: true };
        }
      }
      
      return { success: false, error: response.data.error };
    }
    
    return { success: true, emoji: reaction };
  } catch (err) {
    console.error('Exception adding reaction:', err);
    return { success: false, error: err };
  }
}

// Format votes for display
function formatVotesForDisplay(session, votes) {
  if (!votes || votes.length === 0) {
    return `No votes yet for issue: *${session.issue}*`;
  }
  
  // Count votes by value and collect usernames for each vote value
  const voteCounts = {};
  const voteUsers = {};
  
  votes.forEach(vote => {
    const voteValue = vote.vote.toString();
    // Count votes
    voteCounts[voteValue] = (voteCounts[voteValue] || 0) + 1;
    
    // Collect usernames
    if (!voteUsers[voteValue]) {
      voteUsers[voteValue] = [];
    }
    const username = vote.username || `<@${vote.user_id}>`;
    voteUsers[voteValue].push(username);
  });
  
  // Format results
  let result = `*Results for "${session.issue}"*\n`;
  result += `Total votes: ${votes.length}\n\n`;
  
  // Add vote distribution with usernames
  result += "*Vote distribution:*\n";
  Object.keys(voteCounts).sort((a, b) => parseInt(a) - parseInt(b)).forEach(value => {
    const userList = voteUsers[value].join(', ');
    result += `• ${value} points: ${voteCounts[value]} vote${voteCounts[value] > 1 ? 's' : ''} (${userList})\n`;
  });
  
  return result;
}

/**
 * SLACK COMMAND HANDLERS
 */

// Slack slash command handler
app.post('/slack/commands', async (req, res) => {
  try {
    console.log('Received slash command request:', JSON.stringify(req.body));
    
    // Check if we have the required fields
    const { text, user_id, channel_id, command, response_url } = req.body;
    
    // Immediately acknowledge receipt to prevent timeout
    res.status(200).json({
      response_type: "ephemeral",
      text: `:hourglass: Processing your ${command} command...`
    });
    
    // Process the command asynchronously
    if (command === '/poker-reveal') {
      // Get the latest session for this channel
      const { success, session, error } = await getLatestSessionForChannel(channel_id);
      
      if (!success || !session) {
        return sendDelayedResponse(response_url, {
          response_type: "ephemeral",
          text: `Error: Could not find any active planning poker sessions in this channel.` 
        });
      }
      
      // Get votes for this session
      const { success: votesSuccess, votes, error: votesError } = await getSessionVotes(session.id);
      
      if (!votesSuccess) {
        return sendDelayedResponse(response_url, {
          response_type: "ephemeral",
          text: `Error: Could not fetch results for the current session.` 
        });
      }
      
      // Check if there are any votes before showing results
      if (!votes || votes.length === 0) {
        return sendDelayedResponse(response_url, {
          response_type: "ephemeral",
          text: `No votes have been cast yet for issue: *${session.issue}*\nWait for team members to vote before revealing results.`
        });
      }
      
      const resultsText = formatVotesForDisplay(session, votes);
      
      return sendDelayedResponse(response_url, {
        response_type: "in_channel",
        text: `:tada: *PLANNING POKER RESULTS* :tada:\n${resultsText}`
      });
    }
    
    if (command !== '/poker' && command !== '/poker-reveal') {
      return sendDelayedResponse(response_url, { 
        text: "This endpoint only handles the /poker and /poker-reveal commands." 
      });
    }
    
    // For /poker command, text is required
    if (!text) {
      return sendDelayedResponse(response_url, { 
        response_type: "ephemeral",
        text: "Please provide an issue description or link. Usage: `/poker [issue]`" 
      });
    }
    
    // Generate a unique session ID
    const sessionId = `sess-${Date.now()}`;
    
    // Save the session to Supabase
    const { error } = await supabase
      .from('sessions')
      .insert({ 
        id: sessionId, 
        channel: channel_id, 
        issue: text,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error creating session:', error);
      return sendDelayedResponse(response_url, { 
        response_type: "ephemeral",
        text: "Error: Could not create a new planning poker session." 
      });
    }
    
    // Update the in-memory cache
    latestSessionPerChannel[channel_id] = sessionId;
    
    // Format the issue text for display
    let formattedIssue = text;
    if (text.startsWith('http')) {
      formattedIssue = `<${text}>`;
    }
    
    // Send the response with voting buttons
    return sendDelayedResponse(response_url, {
      response_type: "in_channel",
      text: `Planning Poker started by <@${user_id}> for: *${formattedIssue}*\nSession ID: ${sessionId}\n\nOnce everyone has voted, type \`/poker-reveal\` to reveal the results.`,
      attachments: [
        {
          fallback: "Voting buttons",
          callback_id: "vote",
          color: "#3AA3E3",
          attachment_type: "default",
          actions: [
            { name: "vote", text: "1", type: "button", value: JSON.stringify({ sessionId, vote: 1 }) },
            { name: "vote", text: "2", type: "button", value: JSON.stringify({ sessionId, vote: 2 }) },
            { name: "vote", text: "3", type: "button", value: JSON.stringify({ sessionId, vote: 3 }) },
            { name: "vote", text: "5", type: "button", value: JSON.stringify({ sessionId, vote: 5 }) },
            { name: "vote", text: "8", type: "button", value: JSON.stringify({ sessionId, vote: 8 }) }
          ]
        }
      ]
    });
  } catch (err) {
    console.error('Exception handling slash command:', err);
    
    // If we have a response_url, use it to send an error message
    if (req.body && req.body.response_url) {
      return sendDelayedResponse(req.body.response_url, { 
        text: "Sorry, there was an error processing your command. Please try again." 
      });
    }
    
    // Fallback if we've already sent the initial response
    return;
  }
});

// Helper function to send delayed responses
async function sendDelayedResponse(responseUrl, message) {
  try {
    await axios.post(responseUrl, message);
    return true;
  } catch (error) {
    console.error('Error sending delayed response:', error);
    return false;
  }
}

// Slack interaction handler
app.post('/slack/actions', async (req, res) => {
  try {
    console.log('Received action request:', JSON.stringify(req.body));
    
    if (!req.body.payload) {
      console.log('Missing payload in request');
      return res.status(200).json({ 
        text: "Error: Missing payload in the request." 
      });
    }
    
    const payload = JSON.parse(req.body.payload);
    
    // Extract user and action data from the payload
    const { user, actions, callback_id } = payload;
    
    if (!user || !actions || !actions.length) {
      console.log('Missing required fields in payload');
      return res.status(200).json({ 
        text: "Error: Missing required fields in the payload." 
      });
    }
    
    // For message attachments format
    if (callback_id === 'vote') {
      try {
        const voteData = JSON.parse(actions[0].value);
        const sessionId = voteData.sessionId;
        const vote = voteData.vote;
        
        console.log(`User ${user.id} voted ${vote} for session ${sessionId}`);
        
        if (!sessionId) {
          return res.status(200).json({
            response_type: 'ephemeral',
            text: "Could not determine which session to vote on."
          });
        }
        
        const saveResult = await saveVote(sessionId, user.id, vote, user.name);
        if (!saveResult.success) {
          console.log('Failed to save vote:', saveResult.error);
          return res.status(200).json({
            response_type: 'ephemeral',
            text: `There was an error recording your vote. Please try again.`
          });
        }
        
        // Try to add a reaction to the original message
        if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_BOT_TOKEN.startsWith('xoxb-')) {
          if (payload.channel && payload.message_ts) {
            // For interactive messages, we can get the original message timestamp
            await addReaction(payload.channel.id, payload.message_ts, user.id);
          } else if (payload.channel && payload.original_message && payload.original_message.ts) {
            // For message attachments, we need to use the original_message.ts
            await addReaction(payload.channel.id, payload.original_message.ts, user.id);
          }
        } else {
          console.log('Skipping reaction - SLACK_BOT_TOKEN not properly configured');
        }
        
        // Keep the original message with voting buttons intact for everyone
        return res.status(200).json({
          response_type: 'ephemeral',
          replace_original: false,
          text: `Your vote of *${vote}* has been recorded for session ${sessionId}.`
        });
      } catch (err) {
        console.error('Exception handling vote:', err);
        return res.status(200).json({
          response_type: 'ephemeral',
          text: `There was an error processing your vote. Please try again.`
        });
      }
    }
    
    return res.status(200).json({ 
      text: "Unrecognized action." 
    });
  } catch (err) {
    console.error('Exception handling action:', err);
    return res.status(200).json({ 
      text: "Sorry, there was an error processing your action. Please try again." 
    });
  }
});

/**
 * DATABASE CLEANUP
 */

// Function to clean up old sessions and their votes
async function cleanupOldSessions(daysToKeep = 30) {
  try {
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateString = cutoffDate.toISOString();
    
    console.log(`Cleaning up sessions older than ${daysToKeep} days (before ${cutoffDateString})`);
    
    // First get the IDs of sessions to be deleted
    const { data: oldSessions, error: fetchError } = await supabase
      .from('sessions')
      .select('id')
      .lt('created_at', cutoffDateString);
      
    if (fetchError) {
      console.error('Error fetching old sessions:', fetchError);
      return { success: false, error: fetchError };
    }
    
    if (!oldSessions || oldSessions.length === 0) {
      console.log('No old sessions to clean up');
      return { success: true, deletedSessions: 0, deletedVotes: 0 };
    }
    
    const sessionIds = oldSessions.map(session => session.id);
    console.log(`Found ${sessionIds.length} old sessions to clean up`);
    
    // Delete votes for these sessions first (due to foreign key constraint)
    const { error: votesError, count: votesDeleted } = await supabase
      .from('votes')
      .delete({ count: 'exact' })
      .in('session_id', sessionIds);
      
    if (votesError) {
      console.error('Error deleting votes:', votesError);
      return { success: false, error: votesError };
    }
    
    // Now delete the sessions
    const { error: sessionsError, count: sessionsDeleted } = await supabase
      .from('sessions')
      .delete({ count: 'exact' })
      .in('id', sessionIds);
      
    if (sessionsError) {
      console.error('Error deleting sessions:', sessionsError);
      return { success: false, error: sessionsError };
    }
    
    console.log(`Successfully cleaned up ${sessionsDeleted} sessions and ${votesDeleted} votes`);
    return { 
      success: true, 
      deletedSessions: sessionsDeleted, 
      deletedVotes: votesDeleted 
    };
  } catch (err) {
    console.error('Exception during cleanup:', err);
    return { success: false, error: err };
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Slack Planning Poker running on port ${port}`);
  console.log(`Test your server by visiting http://localhost:${port}`);
  console.log(`For Slack verification, use: http://localhost:${port}/slack/verify`);
  console.log(`Remember to update your Slack App with the correct ngrok URL`);
});
