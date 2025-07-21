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
      expect(message.attachments).toBeDefined();
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].color).toBe('#118461');
      expect(message.attachments[0].blocks).toBeDefined();
      expect(message.attachments[0].blocks).toHaveLength(5); // 5 blocks total
      
      // Check first section block with intro text
      expect(message.attachments[0].blocks[0].type).toBe('section');
      expect(message.attachments[0].blocks[0].text.type).toBe('mrkdwn');
      expect(message.attachments[0].blocks[0].text.text).toContain('How would you estimate this issue?');
      
      // Check divider after intro
      expect(message.attachments[0].blocks[1].type).toBe('divider');
      
      // Check section block with issue text
      expect(message.attachments[0].blocks[2].type).toBe('section');
      expect(message.attachments[0].blocks[2].text.type).toBe('mrkdwn');
      expect(message.attachments[0].blocks[2].text.text).toContain('*Issue:* Test issue');
      
      // Check actions block with voting buttons
      expect(message.attachments[0].blocks[3].type).toBe('actions');
      expect(message.attachments[0].blocks[3].block_id).toBe('vote_actions');
      expect(message.attachments[0].blocks[3].elements).toHaveLength(5); // 5 voting buttons
      
      // Check context block with session info
      expect(message.attachments[0].blocks[4].type).toBe('context');
      expect(message.attachments[0].blocks[4].elements[0].type).toBe('mrkdwn');
      expect(message.attachments[0].blocks[4].elements[0].text).toContain('Session ID: test-session');
    });
  });

  describe('formatPokerResults', () => {
    test('should handle no votes', () => {
      const result = formatPokerResults([], 'Test issue', 'test-session-123');
      
      expect(result.response_type).toBe('ephemeral');
      expect(result.text).toContain('No votes');
    });
    
    test('should format votes correctly', () => {
      const issue = 'Test issue';
      const sessionId = 'test-session-123';
      const votes = [
        { userId: 'U1', userName: 'user1', vote: 3 },
        { userId: 'U2', userName: 'user2', vote: 5 },
        { userId: 'U3', userName: 'user3', vote: 3 }
      ];
      
      const result = formatPokerResults(votes, issue, sessionId);
      
      // Check basic message properties
      expect(result.response_type).toBe('in_channel');
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].color).toBe('#3AA3E3');
      expect(result.attachments[0].blocks).toBeDefined();
      
      const blocks = result.attachments[0].blocks;
      
      // Check header block
      expect(blocks[0].type).toBe('header');
      expect(blocks[0].text.text).toBe('✨ Planning Poker Results');
      
      // Check divider after header
      expect(blocks[1].type).toBe('divider');
      
      // Check main content section with issue, votes, and distribution
      expect(blocks[2].type).toBe('section');
      const mainText = blocks[2].text.text;
      expect(mainText).toContain('*Issue:* Test issue');
      expect(mainText).toContain('*Total votes:* 3');
      expect(mainText).toContain('*Vote distribution:*');
      expect(mainText).toContain('• `3` - 2 votes');
      expect(mainText).toContain('• `5` - 1 vote');
      
      // Check context footer
      expect(blocks[3].type).toBe('context');
      expect(blocks[3].elements[0].type).toBe('mrkdwn');
      expect(blocks[3].elements[0].text).toContain('Voting completed');
      expect(blocks[3].elements[0].text).toContain('Session ID: test-session-123');
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
