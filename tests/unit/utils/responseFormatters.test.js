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
    test('should create a properly formatted message', () => {
      const userId = 'U123';
      const issue = 'Test issue';
      const sessionId = 'test-session';
      
      const message = createPokerSessionMessage(userId, issue, sessionId);
      
      expect(message.response_type).toBe('in_channel');
      expect(message.text).toContain(`<@${userId}>`);
      expect(message.text).toContain(issue);
      expect(message.text).toContain(sessionId);
      expect(message.attachments).toHaveLength(2);
      
      // First attachment: voting buttons
      expect(message.attachments[0].actions).toHaveLength(5);
      expect(message.attachments[0].callback_id).toBe('vote');
      expect(message.attachments[0].color).toBe('#3AA3E3');
      
      // Second attachment: Show Results button
      expect(message.attachments[1].actions).toHaveLength(1);
      expect(message.attachments[1].callback_id).toBe('reveal');
      expect(message.attachments[1].color).toBe('#28a745');
      expect(message.attachments[1].actions[0].name).toBe('reveal');
      expect(message.attachments[1].actions[0].text).toBe('📊 Show Results');
      expect(message.attachments[1].actions[0].style).toBe('primary');
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
