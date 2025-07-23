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
  
  // Create blocks for the message
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: ":thinking_face: How would you estimate this issue?"
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Issue:* ${formattedIssue}\n\nSelect a point value. Emoji reactions are used to represent each anonymous vote. Once everyone has voted, type \`/poker-reveal\` to review the results.`,
      }
    },
    {
      type: "actions",
      block_id: "vote_actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "1"
          },
          value: JSON.stringify({ sessionId, vote: 1 }),
          action_id: "vote_1"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "2"
          },
          value: JSON.stringify({ sessionId, vote: 2 }),
          action_id: "vote_2"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "3"
          },
          value: JSON.stringify({ sessionId, vote: 3 }),
          action_id: "vote_3"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "5"
          },
          value: JSON.stringify({ sessionId, vote: 5 }),
          action_id: "vote_5"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "8"
          },
          value: JSON.stringify({ sessionId, vote: 8 }),
          action_id: "vote_8"
        }
      ]
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Voting started by <@${userId}> • Session ID: ${sessionId}`
        }
      ]
    }
  ];

  return {
    response_type: "in_channel",
    attachments: [
      {
        color: "#118461", // Green color
        blocks: blocks
      }
    ]
  };
}

/**
 * Format the results of a planning poker session
 * @param {Array} votes - Array of votes with user info
 * @param {string} issue - The issue text
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user ID of the person who revealed the votes
 * @returns {Object} Formatted results message for Slack
 */
function formatPokerResults(votes, issue, sessionId = 'N/A', userId = null) {
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
    voteDistributionText += `• \`${value}\` - ${count} vote${count > 1 ? 's' : ''} (${users.join(', ')})\n`;
  });

  // Create blocks for rich formatting
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: ":sparkles: Review your planning poker voting results."
      }
    },
    {
      type: "divider"
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Issue:* ${formattedIssue}\n\n*Total votes:* ${votes.length}\n\n${voteDistributionText}`
      }
    }
  ];

  // Add context footer
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: userId 
          ? `Votes revealed by <@${userId}> • Session ID: ${sessionId}`
          : `Votes revealed • Session ID: ${sessionId}`
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

module.exports = {
  formatIssueText,
  generateVotingButtons,
  createPokerSessionMessage,
  formatPokerResults
};
