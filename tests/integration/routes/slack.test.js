const request = require('supertest');
const nock = require('nock');
const app = require('../../../src/app');
const sessionService = require('../../../src/services/sessionService');
const voteService = require('../../../src/services/voteService');

// Mock services
jest.mock('../../../src/services/sessionService');
jest.mock('../../../src/services/voteService');

// Mock only the getBotTokenForTeam function to avoid interfering with route loading
jest.mock('../../../src/controllers/oauthController', () => {
  const originalModule = jest.requireActual('../../../src/controllers/oauthController');
  return {
    ...originalModule,
    getBotTokenForTeam: jest.fn()
  };
});

// Get the mocked function after the mock is set up
const { getBotTokenForTeam: mockGetBotTokenForTeam } = require('../../../src/controllers/oauthController');

describe('Slack Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
    // Reset OAuth controller mock to return default token
    mockGetBotTokenForTeam.mockResolvedValue(process.env.SLACK_BOT_TOKEN);
  });

  afterEach(() => {
    // Clean up nock interceptors to prevent Jest deprecation warnings
    nock.cleanAll();
    nock.restore();
  });

  describe('POST /slack/verify', () => {
    test('should respond with the challenge value', async () => {
      const response = await request(app)
        .post('/slack/verify')
        .send({ challenge: 'test-challenge' })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ challenge: 'test-challenge' });
    });
  });

  describe('POST /slack/commands', () => {
    test('should handle /poker command', async () => {
      // Mock session creation
      sessionService.createSession.mockResolvedValue({
        success: true,
        sessionId: 'sess-123'
      });
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker',
          text: 'Test issue',
          user_id: 'U123',
          channel_id: 'C123',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(sessionService.createSession).toHaveBeenCalledWith('C123', 'Test issue');
    });

    test('should handle /poker-reveal command', async () => {
      // Mock session retrieval
      sessionService.getLatestSessionForChannel.mockResolvedValue({
        success: true,
        session: { id: 'sess-123', issue: 'Test issue' }
      });
      
      // Mock votes retrieval
      voteService.getSessionVotes.mockResolvedValue({
        success: true,
        votes: [
          { user_id: 'U1', vote: 3, username: 'user1' },
          { user_id: 'U2', vote: 5, username: 'user2' }
        ]
      });
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker-reveal',
          channel_id: 'C123',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(sessionService.getLatestSessionForChannel).toHaveBeenCalledWith('C123');
      expect(voteService.getSessionVotes).toHaveBeenCalledWith('sess-123');
    });

    test('should handle unknown commands', async () => {
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/unknown',
          text: 'Test issue'
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('only handles');
    });

    test('should handle unsupported command', async () => {
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/unsupported',
          text: 'test'
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('only handles');
    });

    test('should handle /poker command with exception', async () => {
      // Mock session creation to throw an exception
      sessionService.createSession.mockRejectedValue(new Error('Database connection failed'));
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker',
          text: 'Test issue',
          user_id: 'U123',
          channel_id: 'C123',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Processing your request');
    });

    test('should handle /poker-reveal command with no active session', async () => {
      // Mock session retrieval to return no session
      sessionService.getLatestSessionForChannel.mockResolvedValue({
        success: true,
        session: null
      });
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker-reveal',
          channel_id: 'C123',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Processing your request');
    });

    test('should handle /poker-reveal command with failed votes retrieval', async () => {
      // Mock session retrieval
      sessionService.getLatestSessionForChannel.mockResolvedValue({
        success: true,
        session: { id: 'sess-123', issue: 'Test issue' }
      });
      
      // Mock votes retrieval to fail
      voteService.getSessionVotes.mockResolvedValue({
        success: false,
        error: 'Database error'
      });
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker-reveal',
          channel_id: 'C123',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Processing your request');
    });

    test('should handle /poker-reveal command with exception', async () => {
      // Mock session retrieval to throw an exception
      sessionService.getLatestSessionForChannel.mockRejectedValue(new Error('Database connection failed'));
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker-reveal',
          channel_id: 'C123',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Processing your request');
    });

    test('should handle /poker command with workspace-specific token', async () => {
      // Mock session creation
      sessionService.createSession.mockResolvedValue({
        success: true,
        sessionId: 'sess-123'
      });
      
      // Mock workspace token lookup
      mockGetBotTokenForTeam.mockResolvedValue('xoxb-workspace-token');
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      // Mock addReaction call with workspace token
      nock('https://slack.com')
        .post('/api/reactions.add')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker',
          text: 'Test issue',
          user_id: 'U123',
          channel_id: 'C123',
          team_id: 'T123456',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(sessionService.createSession).toHaveBeenCalledWith('C123', 'Test issue');
    });

    test('should fallback to default token when workspace token not found', async () => {
      // Mock session creation
      sessionService.createSession.mockResolvedValue({
        success: true,
        sessionId: 'sess-123'
      });
      
      // Mock workspace token lookup returning null (not found)
      mockGetBotTokenForTeam.mockResolvedValue(null);
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      // Mock addReaction call with default token
      nock('https://slack.com')
        .post('/api/reactions.add')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker',
          text: 'Test issue',
          user_id: 'U123',
          channel_id: 'C123',
          team_id: 'T123456',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(mockGetBotTokenForTeam).toHaveBeenCalledWith('T123456');
    });

    test('should handle /poker-reveal command with workspace-specific token', async () => {
      // Mock session retrieval
      sessionService.getLatestSessionForChannel.mockResolvedValue({
        success: true,
        session: { id: 'sess-123', issue: 'Test issue' }
      });
      
      // Mock votes retrieval
      voteService.getSessionVotes.mockResolvedValue({
        success: true,
        votes: [
          { user_id: 'U1', vote: 3, username: 'user1' },
          { user_id: 'U2', vote: 5, username: 'user2' }
        ]
      });
      
      // Mock workspace token lookup
      mockGetBotTokenForTeam.mockResolvedValue('xoxb-workspace-token');
      
      // Mock delayed response
      const responseUrl = 'https://slack.com/response/url';
      nock('https://slack.com')
        .post('/response/url')
        .reply(200, { ok: true });
      
      // Mock addReaction call with workspace token
      nock('https://slack.com')
        .post('/api/reactions.add')
        .reply(200, { ok: true });
      
      const response = await request(app)
        .post('/slack/commands')
        .send({
          command: '/poker-reveal',
          channel_id: 'C123',
          team_id: 'T123456',
          response_url: responseUrl
        })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(mockGetBotTokenForTeam).toHaveBeenCalledWith('T123456');
    });

    test('should handle interactive actions with workspace-specific token', async () => {
      // Mock vote saving
      voteService.saveVote.mockResolvedValue({ success: true });
      
      // Mock workspace token lookup
      mockGetBotTokenForTeam.mockResolvedValue('xoxb-workspace-token');
      
      // Mock addReaction call with workspace token
      nock('https://slack.com')
        .post('/api/reactions.add')
        .reply(200, { ok: true });
      
      const payload = {
        type: 'interactive_message',
        user: { id: 'U123', name: 'testuser' },
        channel: { id: 'C123' },
        team: { id: 'T123456' },
        message_ts: '1234567890.123456',
        actions: [{
          name: 'vote',
          value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
        }]
      };
      
      const response = await request(app)
        .post('/slack/actions')
        .send({ payload: JSON.stringify(payload) })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(mockGetBotTokenForTeam).toHaveBeenCalledWith('T123456');
      expect(voteService.saveVote).toHaveBeenCalledWith('sess-123', 'U123', 5, 'testuser');
    });
  });

  describe('POST /slack/actions', () => {
    test('should handle vote action', async () => {
      // Mock vote saving
      voteService.saveVote.mockResolvedValue({
        success: true
      });
      
      // Mock addReaction call
      nock('https://slack.com')
        .post('/api/reactions.add')
        .reply(200, { ok: true });
      
      const payload = JSON.stringify({
        type: 'interactive_message',
        user: { id: 'U123', name: 'testuser' },
        channel: { id: 'C123' },
        team: { id: 'T123456' },
        message_ts: '1234567890.123456',
        actions: [
          {
            name: 'vote',
            value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
          }
        ]
      });
      
      const response = await request(app)
        .post('/slack/actions')
        .send({ payload })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(voteService.saveVote).toHaveBeenCalledWith(
        'sess-123', 'U123', 5, 'testuser'
      );
      expect(response.body.text).toContain('Your vote (5) has been recorded');
    });

    test('should handle missing payload', async () => {
      const response = await request(app)
        .post('/slack/actions')
        .send({})
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Missing payload');
    });

    test('should handle unsupported action type', async () => {
      const payload = JSON.stringify({
        type: 'interactive_message',
        user: { id: 'U123', name: 'testuser' },
        actions: [
          {
            name: 'not_vote',
            value: 'test'
          }
        ]
      });
      
      const response = await request(app)
        .post('/slack/actions')
        .send({ payload })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Unsupported action');
    });

    test('should handle invalid vote data JSON', async () => {
      const payload = JSON.stringify({
        type: 'interactive_message',
        user: { id: 'U123', name: 'testuser' },
        actions: [
          {
            name: 'vote',
            value: 'invalid-json{'
          }
        ]
      });
      
      const response = await request(app)
        .post('/slack/actions')
        .send({ payload })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Invalid vote data');
    });

    test('should handle failed vote save', async () => {
      // Mock vote saving to fail
      voteService.saveVote.mockResolvedValue({
        success: false,
        error: 'Database error'
      });
      
      const payload = JSON.stringify({
        type: 'interactive_message',
        user: { id: 'U123', name: 'testuser' },
        actions: [
          {
            name: 'vote',
            value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
          }
        ]
      });
      
      const response = await request(app)
        .post('/slack/actions')
        .send({ payload })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Could not save your vote');
    });

    test('should handle exceptions in interactive actions', async () => {
      // Mock saveVote to throw an exception
      voteService.saveVote.mockRejectedValue(new Error('Database connection failed'));
      
      const payload = JSON.stringify({
        type: 'interactive_message',
        user: { id: 'U123', name: 'testuser' },
        actions: [
          {
            name: 'vote',
            value: JSON.stringify({ sessionId: 'sess-123', vote: 5 })
          }
        ]
      });
      
      const response = await request(app)
        .post('/slack/actions')
        .send({ payload })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Sorry, there was an error processing your action');
    });

    test('should handle non-interactive message type', async () => {
      const payload = JSON.stringify({
        type: 'block_actions',
        user: { id: 'U123', name: 'testuser' },
        actions: []
      });
      
      const response = await request(app)
        .post('/slack/actions')
        .send({ payload })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Unsupported action type');
    });

    test('should handle empty actions array', async () => {
      const payload = JSON.stringify({
        type: 'interactive_message',
        user: { id: 'U123', name: 'testuser' },
        actions: []
      });
      
      const response = await request(app)
        .post('/slack/actions')
        .send({ payload })
        .set('Content-Type', 'application/x-www-form-urlencoded');
      
      expect(response.status).toBe(200);
      expect(response.body.text).toContain('Unsupported action type');
    });
  });
});
