const request = require('supertest');
const app = require('../../../src/app');
const nock = require('nock');

// Mock the team service
jest.mock('../../../src/services/teamService', () => ({
  saveTeamInstallation: jest.fn(),
  getTeamInstallation: jest.fn(),
  removeTeamInstallation: jest.fn(),
  listTeamInstallations: jest.fn()
}));

const teamService = require('../../../src/services/teamService');

describe('OAuth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    // Clean up nock interceptors to prevent Jest deprecation warnings
    nock.cleanAll();
    if (!nock.isActive()) {
      nock.activate();
    }
  });

  describe('GET /install', () => {
    test('should redirect to Slack OAuth URL', async () => {
      const response = await request(app)
        .get('/install')
        .expect(302);

      expect(response.headers.location).toMatch(/^https:\/\/slack\.com\/oauth\/v2\/authorize/);
      expect(response.headers.location).toContain('client_id=');
      expect(response.headers.location).toContain('scope=');
      expect(response.headers.location).toContain('redirect_uri=');
    });
  });

  describe('GET /oauth/callback', () => {
    test('should handle successful OAuth callback', async () => {
      // Mock Slack OAuth token exchange
      const mockTokenResponse = {
        ok: true,
        access_token: 'xoxb-test-token',
        team: {
          id: 'T123456',
          name: 'Test Team'
        },
        bot_user_id: 'U123456',
        scope: 'commands,chat:write',
        authed_user: {
          id: 'U789012'
        },
        app_id: 'A123456'
      };

      nock('https://slack.com')
        .post('/api/oauth.v2.access')
        .reply(200, mockTokenResponse);

      // Mock team service save
      teamService.saveTeamInstallation.mockResolvedValue({ success: true });

      const response = await request(app)
        .get('/oauth/callback')
        .query({ code: 'test-auth-code' })
        .expect(302);

      expect(response.headers.location).toBe('/slack/oauth/success');
      expect(teamService.saveTeamInstallation).toHaveBeenCalledWith({
        team_id: 'T123456',
        team_name: 'Test Team',
        bot_token: 'xoxb-test-token',
        bot_user_id: 'U123456',
        scope: 'commands,chat:write',
        installed_at: expect.any(String),
        installer_user_id: 'U789012',
        app_id: 'A123456'
      });
    });

    test('should handle OAuth error', async () => {
      const response = await request(app)
        .get('/oauth/callback')
        .query({ error: 'access_denied' })
        .expect(400);

      expect(response.text).toContain('OAuth Error: access_denied');
    });

    test('should handle missing authorization code', async () => {
      const response = await request(app)
        .get('/oauth/callback')
        .expect(400);

      expect(response.text).toContain('Missing authorization code');
    });

    test('should handle Slack token exchange failure', async () => {
      // Mock failed Slack OAuth token exchange
      const mockTokenResponse = {
        ok: false,
        error: 'invalid_code'
      };

      nock('https://slack.com')
        .post('/api/oauth.v2.access')
        .reply(200, mockTokenResponse);

      const response = await request(app)
        .get('/oauth/callback')
        .query({ code: 'invalid-code' })
        .expect(400);

      expect(response.text).toContain('Token exchange failed: invalid_code');
    });

    test('should handle team installation save failure', async () => {
      // Mock successful Slack OAuth token exchange
      const mockTokenResponse = {
        ok: true,
        access_token: 'xoxb-test-token',
        team: {
          id: 'T123456',
          name: 'Test Team'
        },
        bot_user_id: 'U123456',
        scope: 'commands,chat:write',
        app_id: 'A123456'
      };

      nock('https://slack.com')
        .post('/api/oauth.v2.access')
        .reply(200, mockTokenResponse);

      // Mock team service save failure
      teamService.saveTeamInstallation.mockResolvedValue({ 
        success: false, 
        error: 'Database error' 
      });

      const response = await request(app)
        .get('/oauth/callback')
        .query({ code: 'test-auth-code' })
        .expect(500);

      expect(response.text).toContain('Failed to save installation');
    });

    test('should handle network errors during token exchange', async () => {
      // Mock network error
      nock('https://slack.com')
        .post('/api/oauth.v2.access')
        .replyWithError('Network error');

      const response = await request(app)
        .get('/oauth/callback')
        .query({ code: 'test-auth-code' })
        .expect(500);

      expect(response.text).toContain('Internal server error during OAuth');
    });
  });

  describe('GET /oauth/success', () => {
    test('should display success page', async () => {
      const response = await request(app)
        .get('/oauth/success')
        .expect(200);

      expect(response.text).toContain('Planning Poker Installed Successfully!');
      expect(response.text).toContain('/poker [issue description]');
      expect(response.text).toContain('/poker-reveal');
      expect(response.text).toContain('Happy estimating! 🎯');
    });

    test('should have proper HTML structure', async () => {
      const response = await request(app)
        .get('/oauth/success')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<title>Planning Poker - Installation Success</title>');
      expect(response.text).toContain('class="success-icon"');
      expect(response.text).toContain('class="commands"');
    });
  });

  describe('OAuth Flow Integration', () => {
    test('should complete full OAuth flow successfully', async () => {
      // Step 1: Start OAuth flow
      const installResponse = await request(app)
        .get('/install')
        .expect(302);

      expect(installResponse.headers.location).toMatch(/^https:\/\/slack\.com\/oauth\/v2\/authorize/);

      // Step 2: Handle callback with successful token exchange
      const mockTokenResponse = {
        ok: true,
        access_token: 'xoxb-test-token',
        team: {
          id: 'T123456',
          name: 'Test Team'
        },
        bot_user_id: 'U123456',
        scope: 'commands,chat:write,reactions:write',
        authed_user: {
          id: 'U789012'
        },
        app_id: 'A123456'
      };

      nock('https://slack.com')
        .post('/api/oauth.v2.access')
        .reply(200, mockTokenResponse);

      teamService.saveTeamInstallation.mockResolvedValue({ success: true });

      const callbackResponse = await request(app)
        .get('/oauth/callback')
        .query({ code: 'test-auth-code' })
        .expect(302);

      expect(callbackResponse.headers.location).toBe('/slack/oauth/success');

      // Step 3: Display success page
      const successResponse = await request(app)
        .get('/oauth/success')
        .expect(200);

      expect(successResponse.text).toContain('Planning Poker Installed Successfully!');

      // Verify installation was saved
      expect(teamService.saveTeamInstallation).toHaveBeenCalledWith({
        team_id: 'T123456',
        team_name: 'Test Team',
        bot_token: 'xoxb-test-token',
        bot_user_id: 'U123456',
        scope: 'commands,chat:write,reactions:write',
        installed_at: expect.any(String),
        installer_user_id: 'U789012',
        app_id: 'A123456'
      });
    });
  });
});
