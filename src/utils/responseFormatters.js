/**
 * Format the issue text for display in Slack
 * @param {string} text - The raw issue text
 * @returns {string} Formatted issue text
 */
function formatIssueText(text) {
  if (text.startsWith('http')) {
    return `<${text}>`;
  }
  return text;
}

/**
 * Generate voting buttons for a planning poker session
 * @param {string} sessionId - The session ID
 * @returns {Array} Array of button actions
 */
function generateVotingButtons(sessionId) {
  return [
    { name: "vote", text: "1", type: "button", value: JSON.stringify({ sessionId, vote: 1 }) },
    { name: "vote", text: "2", type: "button", value: JSON.stringify({ sessionId, vote: 2 }) },
    { name: "vote", text: "3", type: "button", value: JSON.stringify({ sessionId, vote: 3 }) },
    { name: "vote", text: "5", type: "button", value: JSON.stringify({ sessionId, vote: 5 }) },
    { name: "vote", text: "8", type: "button", value: JSON.stringify({ sessionId, vote: 8 }) }
  ];
}

/**
 * Create a new planning poker session message
 * @param {string} userId - The user who started the session
 * @param {string} issue - The issue text
 * @param {string} sessionId - The session ID
 * @returns {Object} Formatted message for Slack
 */
function createPokerSessionMessage(userId, issue, sessionId) {
  const formattedIssue = formatIssueText(issue);
  
  return {
    response_type: "in_channel",
    text: `Planning Poker started by <@${userId}> for: *${formattedIssue}*\nSession ID: ${sessionId}\n\nOnce everyone has voted, type \`/poker-reveal\` to reveal the results.`,
    attachments: [
      {
        fallback: "Voting buttons",
        callback_id: "vote",
        color: "#3AA3E3",
        attachment_type: "default",
        actions: generateVotingButtons(sessionId)
      }
    ]
  };
}

/**
 * Format the results of a planning poker session
 * @param {Array} votes - Array of votes with user info
 * @param {string} issue - The issue text
 * @returns {Object} Formatted results message for Slack
 */
function formatPokerResults(votes, issue) {
  if (!votes || votes.length === 0) {
    return {
      response_type: "ephemeral",
      text: "No votes have been cast for the current session."
    };
  }

  const formattedIssue = formatIssueText(issue);
  
  // Count votes by value
  const voteCounts = {};
  votes.forEach(vote => {
    if (!voteCounts[vote.vote]) {
      voteCounts[vote.vote] = { count: 0, users: [] };
    }
    voteCounts[vote.vote].count++;
    voteCounts[vote.vote].users.push(vote.username || `<@${vote.user_id}>`);
  });
  
  // Create vote distribution text in bullet format
  let voteDistributionText = "*Vote distribution:*\n";
  Object.keys(voteCounts).sort((a, b) => a - b).forEach(value => {
    const { count, users } = voteCounts[value];
    voteDistributionText += `• ${value} points: ${count} vote${count > 1 ? 's' : ''} (${users.join(', ')})\n`;
  });

  // Create blocks for rich formatting
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🎯 Planning Poker Results"
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Issue:* ${formattedIssue}\n*Total votes:* ${votes.length}\n\n${voteDistributionText}`
      }
    },
    {
      type: "divider"
    }
  ];

  // Add context footer
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "Voting completed • Results visible to channel"
      }
    ]
  });
  
  return {
    response_type: "in_channel",
    attachments: [
      {
        color: "#3AA3E3", // Informational blue color
        blocks: blocks
      }
    ]
  };
}

/**
 * Generate HTML response for admin cleanup endpoint
 * @param {Object} result - The cleanup result
 * @returns {string} HTML response
 */
function generateCleanupHtmlResponse(result) {
  return `
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
  `;
}

module.exports = {
  formatIssueText,
  generateVotingButtons,
  createPokerSessionMessage,
  formatPokerResults,
  generateCleanupHtmlResponse
};
