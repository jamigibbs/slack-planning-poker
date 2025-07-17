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
    result += `• ${value}: ${voteCounts[value]} vote${voteCounts[value] > 1 ? 's' : ''} (${userList})\n`;
  });
  
  return result;
}

/**
 * SLACK COMMAND HANDLERS
 */

// Slack slash command handler
app.post('/slack/commands', async (req, res) => {
  try {
    // Check if we have the required fields
    const { text, user_id, channel_id, command } = req.body;
    
    // Validate common required fields for all commands
    if (!user_id || !channel_id) {
      console.log('Missing user_id or channel_id fields');
      return res.status(200).json({ 
        text: "Error: Missing user or channel information." 
      });
    }
    
    if (command === '/poker-reveal') {
      // Handle the reveal command - show results for the latest session in this channel
      // First check in-memory cache
      let sessionId = latestSessionPerChannel[channel_id];
      
      // If not in memory, try to get from database
      if (!sessionId) {
        const { success, session } = await getLatestSessionForChannel(channel_id);
        
        if (!success || !session) {
          return res.status(200).json({
            response_type: "ephemeral",
            text: "No active planning poker session found in this channel. Start one with `/poker [issue]`"
          });
        }
        
        sessionId = session.id;
        // Update the in-memory cache
        latestSessionPerChannel[channel_id] = sessionId;
      }

      const { success, error, session, votes } = await getSessionVotes(sessionId);
      
      if (!success || !session) {
        console.error('Error fetching results:', error);
        return res.status(200).json({ 
          response_type: "ephemeral",
          text: `Error: Could not fetch results for the current session.` 
        });
      }
      
      // Check if there are any votes before showing results
      if (!votes || votes.length === 0) {
        return res.status(200).json({
          response_type: "ephemeral",
          text: `No votes have been cast yet for issue: *${session.issue}*\nWait for team members to vote before revealing results.`
        });
      }
      
      const resultsText = formatVotesForDisplay(session, votes);
      
      return res.status(200).json({
        response_type: "in_channel",
        text: `:tada: *PLANNING POKER RESULTS* :tada:\n${resultsText}`
      });
    }
    
    if (command !== '/poker' && command !== '/poker-reveal') {
      console.log(`Unexpected command: ${command}`);
      return res.status(200).json({ 
        text: "This endpoint only handles the /poker and /poker-reveal commands." 
      });
    }
    
    // For /poker command, text is required
    if (!text) {
      console.log('Missing text field for /poker command');
      return res.status(200).json({ 
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
      return res.status(200).json({ 
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
    
    // Respond with voting buttons using message attachments format
    return res.status(200).json({
      response_type: "in_channel",
      text: `Planning Poker started by <@${user_id}> for: *${formattedIssue}*\nSession ID: ${sessionId}\n\nOnce everyone has voted, type \`/poker-reveal\` to reveal the results.`,
      attachments: [
        {
          text: "Choose your estimate:",
          fallback: "You are unable to vote",
          callback_id: "vote",
          color: "#3AA3E3",
          attachment_type: "default",
          actions: [
            { name: "vote", text: "1", type: "button", value: "1" },
            { name: "vote", text: "2", type: "button", value: "2" },
            { name: "vote", text: "3", type: "button", value: "3" },
            { name: "vote", text: "5", type: "button", value: "5" },
            { name: "vote", text: "8", type: "button", value: "8" }
          ]
        }
      ]
    });
  } catch (err) {
    console.error('Exception handling slash command:', err);
    
    // Always return a 200 status to Slack, even for errors
    return res.status(200).json({ 
      text: "Sorry, there was an error processing your command. Please try again." 
    });
  }
});

// Slack interaction handler
app.post('/slack/actions', async (req, res) => {
  try {
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
      const vote = actions[0].value;
      // Extract session ID from the message text
      const messageText = payload.original_message.text;
      const sessionIdMatch = messageText.match(/Session ID: (sess-\d+)/);
      const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
      
      console.log(`User ${user.id} voted ${vote} for session ${sessionId}`);
      
      if (!sessionId) {
        return res.status(200).json({
          response_type: 'ephemeral',
          text: "Could not determine which session to vote on."
        });
      }
      
      const saveResult = await saveVote(sessionId, user.id, parseInt(vote), user.name);
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

// Start the server
app.listen(port, () => {
  console.log(`Slack Planning Poker running on port ${port}`);
  console.log(`Test your server by visiting http://localhost:${port}`);
  console.log(`For Slack verification, use: http://localhost:${port}/slack/verify`);
  console.log(`Remember to update your Slack App with the correct ngrok URL`);
});
