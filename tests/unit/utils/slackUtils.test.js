const axios = require('axios');
const { 
  getRandomEmoji, 
  sendDelayedResponse,
  addReaction
} = require('../../../src/utils/slackUtils');
const validEmojis = require('../../../src/utils/emojiList.json');

// Mock axios
jest.mock('axios');

describe('Slack Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment variable for tests
    process.env.SLACK_BOT_TOKEN = 'test-bot-token';
  });

  describe('getRandomEmoji', () => {
    test('should return a string', () => {
      const emoji = getRandomEmoji();
      expect(typeof emoji).toBe('string');
    });

    test('should return a valid emoji from the list', () => {
      const emoji = getRandomEmoji();
      expect(validEmojis).toContain(emoji);
    });
  });

  describe('addReaction', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should add a reaction successfully', async () => {
      // Setup
      const mockResponse = { data: { ok: true } };
      axios.post.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await addReaction('C123', '1234567890.123456', 'thumbsup', 'test-bot-token');
      
      // Assert
      expect(axios.post).toHaveBeenCalledWith(
        'https://slack.com/api/reactions.add',
        {
          channel: 'C123',
          timestamp: '1234567890.123456',
          name: 'thumbsup'
        },
        {
          headers: {
            'Authorization': 'Bearer test-bot-token',
            'Content-Type': 'application/json; charset=utf-8'
          }
        }
      );
      expect(result.success).toBe(true);
      expect(result.emoji).toBe('thumbsup');
    });

    test('should skip reaction when no timestamp provided', async () => {
      // Execute
      const result = await addReaction('C123', null, 'thumbsup', 'test-bot-token');
      
      // Assert
      expect(axios.post).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('No timestamp provided');
    });

    test('should use random emoji when none provided', async () => {
      // Setup
      const mockResponse = { data: { ok: true } };
      axios.post.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await addReaction('C123', '1234567890.123456', 'test-bot-token');
      
      // Assert
      expect(axios.post).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(typeof result.emoji).toBe('string');
    });

    test('should handle already_reacted error by retrying with different emoji', async () => {
      // Setup
      const mockErrorResponse = { data: { ok: false, error: 'already_reacted' } };
      const mockSuccessResponse = { data: { ok: true } };
      axios.post
        .mockResolvedValueOnce(mockErrorResponse)
        .mockResolvedValueOnce(mockSuccessResponse);
      
      // Execute
      const result = await addReaction('C123', '1234567890.123456', 'thumbsup', 'test-bot-token');
      
      // Assert
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    test('should handle not_in_channel error', async () => {
      // Setup
      const mockResponse = { data: { ok: false, error: 'not_in_channel' } };
      axios.post.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await addReaction('C123', '1234567890.123456', 'test-bot-token');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Bot not in channel');
    });

    test('should handle missing_scope error', async () => {
      // Setup
      const mockResponse = { data: { ok: false, error: 'missing_scope' } };
      axios.post.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await addReaction('C123', '1234567890.123456', 'test-bot-token');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing scope');
    });

    test('should handle other API errors', async () => {
      // Setup
      const mockResponse = { data: { ok: false, error: 'some_other_error' } };
      axios.post.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await addReaction('C123', '1234567890.123456', 'test-bot-token');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('some_other_error');
    });

    test('should handle network exceptions', async () => {
      // Setup
      const networkError = new Error('Network error');
      axios.post.mockRejectedValue(networkError);
      
      // Execute
      const result = await addReaction('C123', '1234567890.123456', 'test-bot-token');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(networkError);
    });
  });

  describe('sendDelayedResponse', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should send a post request to the response URL', async () => {
      // Setup
      axios.post.mockResolvedValue({ data: { ok: true } });
      const responseUrl = 'https://slack.com/response/url';
      const message = { text: 'Test message' };
      
      // Execute
      const result = await sendDelayedResponse(responseUrl, message);
      
      // Assert
      expect(axios.post).toHaveBeenCalledWith(responseUrl, message);
      expect(result).toBe(true);
    });

    test('should return false on error', async () => {
      // Setup
      axios.post.mockRejectedValue(new Error('Network error'));
      const responseUrl = 'https://slack.com/response/url';
      const message = { text: 'Test message' };
      
      // Execute
      const result = await sendDelayedResponse(responseUrl, message);
      
      // Assert
      expect(axios.post).toHaveBeenCalledWith(responseUrl, message);
      expect(result).toBe(false);
    });
  });
});
