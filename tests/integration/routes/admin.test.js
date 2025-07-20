const request = require('supertest');
const app = require('../../../src/app');
const sessionService = require('../../../src/services/sessionService');

// Mock services
jest.mock('../../../src/services/sessionService');

// Save original env
const originalEnv = process.env;

describe('Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup test environment
    process.env = { ...originalEnv };
    process.env.ADMIN_KEY = 'test-admin-key';
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('POST /admin/cleanup', () => {
    test('should clean up old sessions with valid key', async () => {
      // Mock cleanup function
      sessionService.cleanupOldSessions.mockResolvedValue({
        success: true,
        deletedSessions: 5,
        deletedVotes: 10
      });
      
      const response = await request(app)
        .post('/admin/cleanup')
        .send({ key: 'test-admin-key', days: 30 })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(sessionService.cleanupOldSessions).toHaveBeenCalledWith(30);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedSessions).toBe(5);
      expect(response.body.deletedVotes).toBe(10);
    });

    test('should reject invalid key', async () => {
      const response = await request(app)
        .post('/admin/cleanup')
        .send({ key: 'wrong-key', days: 30 })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
      expect(sessionService.cleanupOldSessions).not.toHaveBeenCalled();
    });

    test('should handle invalid days parameter', async () => {
      const response = await request(app)
        .post('/admin/cleanup')
        .send({ key: 'test-admin-key', days: -1 })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid days');
      expect(sessionService.cleanupOldSessions).not.toHaveBeenCalled();
    });

    test('should use default days if not provided', async () => {
      // Mock cleanup function
      sessionService.cleanupOldSessions.mockResolvedValue({
        success: true,
        deletedSessions: 3,
        deletedVotes: 6
      });
      
      const response = await request(app)
        .post('/admin/cleanup')
        .send({ key: 'test-admin-key' })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(sessionService.cleanupOldSessions).toHaveBeenCalledWith(30); // Default value
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /admin/cleanup', () => {
    test('should clean up old sessions with valid key', async () => {
      // Mock cleanup function
      sessionService.cleanupOldSessions.mockResolvedValue({
        success: true,
        deletedSessions: 5,
        deletedVotes: 10
      });
      
      const response = await request(app)
        .get('/admin/cleanup')
        .query({ key: 'test-admin-key', days: 30 });
      
      expect(response.status).toBe(200);
      expect(sessionService.cleanupOldSessions).toHaveBeenCalledWith(30);
      expect(response.text).toContain('Success');
    });

    test('should reject invalid key', async () => {
      const response = await request(app)
        .get('/admin/cleanup')
        .query({ key: 'wrong-key', days: 30 });
      
      expect(response.status).toBe(401);
      expect(response.text).toContain('Unauthorized');
      expect(sessionService.cleanupOldSessions).not.toHaveBeenCalled();
    });

    test('should handle invalid days parameter', async () => {
      const response = await request(app)
        .get('/admin/cleanup')
        .query({ key: 'test-admin-key', days: -1 });
      
      expect(response.status).toBe(400);
      expect(response.text).toContain('Invalid days');
      expect(sessionService.cleanupOldSessions).not.toHaveBeenCalled();
    });

    test('should use default days if not provided', async () => {
      // Mock cleanup function
      sessionService.cleanupOldSessions.mockResolvedValue({
        success: true,
        deletedSessions: 3,
        deletedVotes: 6
      });
      
      const response = await request(app)
        .get('/admin/cleanup')
        .query({ key: 'test-admin-key' });
      
      expect(response.status).toBe(200);
      expect(sessionService.cleanupOldSessions).toHaveBeenCalledWith(30); // Default value
      expect(response.text).toContain('Success');
    });
  });
});
