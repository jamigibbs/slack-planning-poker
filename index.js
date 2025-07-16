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

// Utility to save a vote
async function saveVote(sessionId, userId, vote) {
  try {
    const { error } = await supabase
      .from('votes')
      .insert({ session_id: sessionId, user_id: userId, vote: vote });
    
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

// Utility to get the latest session for a channel
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

// Utility to get all votes for a session
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

// Slack slash command handler
app.post('/slack/commands', async (req, res) => {
  try {
    console.log('Received slash command with body:', JSON.stringify(req.body));
    
    // More detailed logging of request fields
    console.log('Request fields:');
    console.log('- text:', req.body.text);
    console.log('- user_id:', req.body.user_id);
    console.log('- channel_id:', req.body.channel_id);
    console.log('- command:', req.body.command);
    
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
        text: "Error: Please provide an issue description. Usage: /poker [issue]" 
      });
    }

    const sessionId = `sess-${Date.now()}`;
    console.log(`Creating session ${sessionId} for channel ${channel_id} with issue: ${text}`);

    try {
      // Save session info to Supabase with created_at timestamp
      const { error } = await supabase
        .from('sessions')
        .insert({ 
          id: sessionId, 
          channel: channel_id, 
          issue: text,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Supabase error saving session:', error);
        return res.status(200).json({ 
          text: "Sorry, there was an error saving your session. Please try again." 
        });
      }
    } catch (dbError) {
      console.error('Exception saving session to Supabase:', dbError);
      return res.status(200).json({ 
        text: "Sorry, there was a database error. Please try again." 
      });
    }

    console.log('Successfully saved session, sending response to Slack');
    
    // Format the issue text - handle URLs specially
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
            {
              name: "vote",
              text: "1",
              type: "button",
              value: "1"
            },
            {
              name: "vote",
              text: "2",
              type: "button",
              value: "2"
            },
            {
              name: "vote",
              text: "3",
              type: "button",
              value: "3"
            },
            {
              name: "vote",
              text: "5",
              type: "button",
              value: "5"
            },
            {
              name: "vote",
              text: "8",
              type: "button",
              value: "8"
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Error handling slash command:', error);
    // Always return a 200 status to Slack, even for errors
    return res.status(200).json({ 
      text: "Sorry, there was an error processing your command. Please try again." 
    });
  }
});

// Slack interaction handler
app.post('/slack/actions', async (req, res) => {
  try {
    console.log('Received action with body:', req.body);
    
    if (!req.body.payload) {
      console.log('Missing payload in request');
      return res.status(200).json({ 
        text: "Error: Missing payload in the request." 
      });
    }
    
    const payload = JSON.parse(req.body.payload);
    console.log('Parsed payload:', JSON.stringify(payload));
    
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
      
      const saveResult = await saveVote(sessionId, user.id, parseInt(vote));
      if (!saveResult.success) {
        console.log('Failed to save vote:', saveResult.error);
        return res.status(200).json({
          response_type: 'ephemeral',
          text: `There was an error recording your vote. Please try again.`
        });
      }
      
      return res.status(200).json({
        response_type: 'ephemeral',
        text: `Your vote of *${vote}* has been recorded for session ${sessionId}.`
      });
    }
    
    return res.status(200).json({
      response_type: 'ephemeral',
      text: "Unknown action type."
    });
  } catch (error) {
    console.error('Error handling action:', error);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: "Sorry, there was an error processing your action. Please try again."
    });
  }
});

// Format votes for display
function formatVotesForDisplay(session, votes) {
  if (!votes || votes.length === 0) {
    return `No votes yet for issue: *${session.issue}*`;
  }
  
  // Count votes by value
  const voteCounts = {};
  votes.forEach(vote => {
    const voteValue = vote.vote.toString();
    voteCounts[voteValue] = (voteCounts[voteValue] || 0) + 1;
  });
  
  // Format results
  let result = `*Results for "${session.issue}"*\n`;
  result += `Total votes: ${votes.length}\n\n`;
  
  // Add vote distribution
  result += "*Vote distribution:*\n";
  Object.keys(voteCounts).sort((a, b) => parseInt(a) - parseInt(b)).forEach(value => {
    result += `• ${value}: ${voteCounts[value]} vote${voteCounts[value] > 1 ? 's' : ''}\n`;
  });
  
  return result;
}

app.listen(port, () => {
  console.log(`Slack Planning Poker running on port ${port}`);
  console.log(`Test your server by visiting http://localhost:${port}`);
  console.log(`For Slack verification, use: http://localhost:${port}/slack/verify`);
  console.log(`Remember to update your Slack App with the correct ngrok URL`);
});
