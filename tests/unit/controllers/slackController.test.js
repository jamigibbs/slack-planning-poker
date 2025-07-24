const { handleInteractiveActions } = require('../../../src/controllers/slackController');

// Mock dependencies
jest.mock('../../../src/services/voteService', () => ({
  saveVote: jest.fn(),
  hasUserVoted: jest.fn()
}));

jest.mock('../../../src/controllers/oauthController', () => ({
  getBotTokenForTeam: jest.fn()
}));

jest.mock('../../../src/utils', () => ({
  addReaction: jest.fn(),
  sendDelayedResponse: jest.fn(),
  createPokerSessionMessage: jest.fn(),
  formatPokerResults: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

// Import mocked modules
const voteService = require('../../../src/services/voteService');
const { getBotTokenForTeam } = require('../../../src/controllers/oauthController');
const { addReaction } = require('../../../src/utils');

describe('Slack Controller', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request and response
    req = {
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    // Default mock implementations
    voteService.hasUserVoted.mockResolvedValue({
      success: true,
      hasVoted: false
    });

    voteService.saveVote.mockResolvedValue({
      success: true
    });

    // Mock the imported functions
    getBotTokenForTeam.mockResolvedValue('xoxb-test-token');
    addReaction.mockResolvedValue({ ok: true });
  });

  describe('handleInteractiveActions', () => {
    test('should handle missing payload', async () => {
      await handleInteractiveActions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        text: "Error: Missing payload in the request."
      });
    });

    test('should handle invalid JSON payload', async () => {
      req.body.payload = 'not-valid-json';
      
      await handleInteractiveActions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        text: "Sorry, there was an error processing your action. Please try again."
      });
    });

    test('should handle block_actions payload with no actions', async () => {
      req.body.payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', name: 'testuser' },
        actions: []
      });
      
      await handleInteractiveActions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        text: expect.stringContaining('No actions found')
      });
    });

    test('should handle block_actions payload with unsupported action', async () => {
      req.body.payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', name: 'testuser' },
        actions: [{
          action_id: 'not_a_vote_action',
          value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
        }]
      });
      
      await handleInteractiveActions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        text: expect.stringContaining('Unsupported action')
      });
    });

    test('should handle block_actions payload with invalid vote data', async () => {
      req.body.payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', name: 'testuser' },
        actions: [{
          action_id: 'vote_5',
          value: 'not-valid-json'
        }]
      });
      
      await handleInteractiveActions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        text: expect.stringContaining('Invalid vote data')
      });
    });

    test('should handle block_actions payload with valid vote data', async () => {
      req.body.payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', username: 'testuser' },
        team: { id: 'T123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123456' },
        actions: [{
          action_id: 'vote_5',
          value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
        }]
      });
      
      await handleInteractiveActions(req, res);
      
      // Check that vote was saved
      expect(voteService.saveVote).toHaveBeenCalledWith(
        'sess-123', 
        'U123', 
        5, 
        'testuser'
      );
      
      // Check that reaction was added
      expect(addReaction).toHaveBeenCalledWith(
        'C123',
        '1234567890.123456',
        null,
        'xoxb-test-token'
      );
      
      // Check response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':white_check_mark: Your vote (5) has been recorded.'
      });
    });

    test('should handle failed vote saving', async () => {
      // Override the default mock for this test
      voteService.saveVote.mockResolvedValueOnce({
        success: false,
        error: 'Test error'
      });

      req.body.payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', username: 'testuser' },
        team: { id: 'T123' },
        actions: [{
          action_id: 'vote_5',
          value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
        }]
      });
      
      await handleInteractiveActions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        text: "Error: Could not save your vote."
      });
    });

    test('should handle vote update for existing voter', async () => {
      // Override the default mock for this test
      voteService.hasUserVoted.mockResolvedValueOnce({
        success: true,
        hasVoted: true
      });

      req.body.payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', username: 'testuser' },
        team: { id: 'T123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123456' },
        actions: [{
          action_id: 'vote_5',
          value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
        }]
      });
      
      await handleInteractiveActions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':arrows_counterclockwise: Your vote (5) has been updated.'
      });
    });

    test('should handle unsupported payload type', async () => {
      req.body.payload = JSON.stringify({
        type: 'unsupported_type',
        user: { id: 'U123', name: 'testuser' }
      });
      
      await handleInteractiveActions(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        text: "Error: Unsupported payload type."
      });
    });

    test('should add reaction for first-time vote but not for vote updates', async () => {
      // First test: First-time vote should add reaction
      voteService.hasUserVoted.mockResolvedValueOnce({
        success: true,
        hasVoted: false
      });

      req.body.payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', username: 'testuser' },
        team: { id: 'T123' },
        channel: { id: 'C123' },
        message: { ts: '1234567890.123456' },
        actions: [{
          action_id: 'vote_5',
          value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
        }]
      });
      
      await handleInteractiveActions(req, res);
      
      // Verify reaction was added for first-time vote
      expect(addReaction).toHaveBeenCalledWith(
        'C123',
        '1234567890.123456',
        null,
        'xoxb-test-token'
      );
      
      // Reset mocks for second test
      jest.clearAllMocks();
      
      // Second test: Vote update should NOT add reaction
      voteService.hasUserVoted.mockResolvedValueOnce({
        success: true,
        hasVoted: true
      });
      
      voteService.saveVote.mockResolvedValueOnce({
        success: true
      });

      await handleInteractiveActions(req, res);
      
      // Verify reaction was NOT added for vote update
      expect(addReaction).not.toHaveBeenCalled();
      
      // Verify ephemeral message was still sent
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        replace_original: false,
        text: ':arrows_counterclockwise: Your vote (5) has been updated.'
      });
    });
  });
});
