const { 
  formatIssueText, 
  generateVotingButtons,
  createPokerSessionMessage,
  formatPokerResults,
  generateCleanupHtmlResponse
} = require('../../../src/utils/responseFormatters');

describe('Response Formatters', () => {
  describe('formatIssueText', () => {
    test('should format URLs with angle brackets', () => {
      const url = 'https://github.com/jamigibbs/slack-planning-poker/issues/1';
      expect(formatIssueText(url)).toBe(`<${url}>`);
    });

    test('should return plain text as is', () => {
      const text = 'Add new feature';
      expect(formatIssueText(text)).toBe(text);
    });
  });

  describe('generateVotingButtons', () => {
    test('should generate buttons with correct values', () => {
      const sessionId = 'test-session';
      const buttons = generateVotingButtons(sessionId);
      
      expect(buttons).toHaveLength(5);
      expect(buttons[0].name).toBe('vote');
      expect(buttons[0].text).toBe('1');
      expect(buttons[0].type).toBe('button');
      expect(JSON.parse(buttons[0].value)).toEqual({ sessionId, vote: 1 });
    });
  });

  describe('createPokerSessionMessage', () => {
    test('should create a properly formatted message with Block Kit', () => {
      const userId = 'U123';
      const issue = 'Test issue';
      const sessionId = 'test-session';
      
      const message = createPokerSessionMessage(userId, issue, sessionId);
      
      // Check basic message properties
      expect(message.response_type).toBe('in_channel');
      expect(message.blocks).toBeDefined();
      expect(message.blocks).toHaveLength(4);
      
      // Check header block
      expect(message.blocks[0].type).toBe('header');
      expect(message.blocks[0].text.type).toBe('plain_text');
      expect(message.blocks[0].text.text).toContain('Planning Poker Session');
      
      // Check section block with message content
      expect(message.blocks[1].type).toBe('section');
      expect(message.blocks[1].text.type).toBe('mrkdwn');
      const sectionText = message.blocks[1].text.text;
      expect(sectionText).toContain(`<@${userId}>`);
      expect(sectionText).toContain(issue);
      expect(sectionText).toContain('/poker-reveal');
      
      // Check actions block with voting buttons
      expect(message.blocks[2].type).toBe('actions');
      expect(message.blocks[2].block_id).toBe('vote_actions');
      expect(message.blocks[2].elements).toHaveLength(5);
      
      // Check first button
      const firstButton = message.blocks[2].elements[0];
      expect(firstButton.type).toBe('button');
      expect(firstButton.text.type).toBe('plain_text');
      expect(firstButton.text.text).toBe('1');
      expect(firstButton.action_id).toBe('vote_1');
      expect(JSON.parse(firstButton.value)).toEqual({ sessionId, vote: 1 });
      
      // Check context footer
      expect(message.blocks[3].type).toBe('context');
      expect(message.blocks[3].elements[0].type).toBe('mrkdwn');
      expect(message.blocks[3].elements[0].text).toContain('Click a button to cast your vote');
      expect(message.blocks[3].elements[0].text).toContain(`Session ID: ${sessionId}`);
    });
  });

  describe('formatPokerResults', () => {
    test('should handle no votes', () => {
      const result = formatPokerResults([], 'Test issue');
      
      expect(result.response_type).toBe('ephemeral');
      expect(result.text).toContain('No votes');
    });
    
    test('should format votes correctly', () => {
      const votes = [
        { user_id: 'U1', vote: 3, username: 'user1' },
        { user_id: 'U2', vote: 5, username: 'user2' },
        { user_id: 'U3', vote: 3, username: 'user3' }
      ];
      
      const result = formatPokerResults(votes, 'Test issue');
      
      expect(result.response_type).toBe('in_channel');
      expect(result.attachments).toBeDefined();
      
      // Check attachment with colored border
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].color).toBe('#3AA3E3');
      expect(result.attachments[0].blocks).toBeDefined();
      
      const blocks = result.attachments[0].blocks;
      
      // Check header block
      expect(blocks[0].type).toBe('header');
      expect(blocks[0].text.text).toBe('🎯 Planning Poker Results');
      
      // Check main content section with issue, votes, and distribution
      expect(blocks[1].type).toBe('section');
      const mainText = blocks[1].text.text;
      expect(mainText).toContain('*Issue:* Test issue');
      expect(mainText).toContain('*Total votes:* 3');
      expect(mainText).toContain('*Vote distribution:*');
      expect(mainText).toContain('• 3 points: 2 votes (user1, user3)');
      expect(mainText).toContain('• 5 points: 1 vote (user2)');
      
      // Check divider
      expect(blocks[2].type).toBe('divider');
      
      // Check context footer
      const lastBlock = blocks[blocks.length - 1];
      expect(lastBlock.type).toBe('context');
      expect(lastBlock.elements[0].text).toContain('Voting completed');
    });
  });

  describe('generateCleanupHtmlResponse', () => {
    test('should generate success HTML', () => {
      const result = {
        success: true,
        deletedSessions: 5,
        deletedVotes: 10
      };
      
      const html = generateCleanupHtmlResponse(result);
      
      expect(html).toContain('Success!');
      expect(html).toContain('5</strong> old sessions');
      expect(html).toContain('10</strong> associated votes');
    });
    
    test('should generate error HTML', () => {
      const result = {
        success: false,
        error: 'Test error'
      };
      
      const html = generateCleanupHtmlResponse(result);
      
      expect(html).toContain('Error');
      expect(html).toContain('Test error');
    });
  });
});
