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
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].actions).toHaveLength(5);
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
      expect(result.text).toContain(':tada: PLANNING POKER RESULTS :tada:');
      expect(result.text).toContain('Results for "Test issue"');
      expect(result.text).toContain('Total votes: 3');
      expect(result.text).toContain('Vote distribution:');
      expect(result.text).toContain('• 3 points: 2 votes');
      expect(result.text).toContain('• 5 points: 1 vote');
      expect(result.text).toContain('user1');
      expect(result.text).toContain('user2');
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
