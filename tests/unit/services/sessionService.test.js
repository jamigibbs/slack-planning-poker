const { 
  createSession,
  getLatestSessionForChannel,
  latestSessionPerChannel
} = require('../../../src/services/sessionService');

// Mock Supabase with proper method chaining
jest.mock('../../../src/db/supabase', () => {
  const mockSupabase = {
    from: jest.fn(),
    insert: jest.fn(),
    select: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    lt: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn()
  };

  // Make all methods return the mock object for chaining
  Object.keys(mockSupabase).forEach(key => {
    if (typeof mockSupabase[key] === 'function') {
      mockSupabase[key].mockReturnValue(mockSupabase);
    }
  });

  return mockSupabase;
});

const supabase = require('../../../src/db/supabase');

describe('Session Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear in-memory cache
    Object.keys(latestSessionPerChannel).forEach(key => {
      delete latestSessionPerChannel[key];
    });
    
    // Reset all mocks to return the mock object for chaining
    Object.keys(supabase).forEach(key => {
      if (typeof supabase[key] === 'function') {
        supabase[key].mockReturnValue(supabase);
      }
    });
  });

  describe('createSession', () => {
    test('should create a new session successfully', async () => {
      // Setup
      const mockResponse = { error: null };
      supabase.insert.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await createSession('C123', 'Test issue');
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'C123',
        issue: 'Test issue'
      }));
      expect(result.success).toBe(true);
      expect(result.sessionId).toMatch(/^sess-\d+$/);
      expect(latestSessionPerChannel['C123']).toBe(result.sessionId);
    });

    test('should handle database errors', async () => {
      // Setup
      const mockError = { error: { message: 'Database error' } };
      supabase.insert.mockResolvedValue(mockError);
      
      // Execute
      const result = await createSession('C123', 'Test issue');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.error);
    });
  });

  describe('getLatestSessionForChannel', () => {
    test('should return session from in-memory cache if available', async () => {
      // Setup
      latestSessionPerChannel['C123'] = 'sess-123';
      const mockResponse = { 
        data: [{ id: 'sess-123', channel: 'C123', issue: 'Test issue' }],
        error: null 
      };
      supabase.limit.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await getLatestSessionForChannel('C123');
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(supabase.select).toHaveBeenCalledWith('*');
      expect(supabase.eq).toHaveBeenCalledWith('id', 'sess-123');
      expect(supabase.limit).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockResponse.data[0]);
    });

    test('should query database if not in cache', async () => {
      // Setup
      const mockResponse = { 
        data: [{ id: 'sess-456', channel: 'C123', issue: 'Test issue' }],
        error: null 
      };
      supabase.limit.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await getLatestSessionForChannel('C123');
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(supabase.select).toHaveBeenCalledWith('*');
      expect(supabase.eq).toHaveBeenCalledWith('channel', 'C123');
      expect(supabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(supabase.limit).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockResponse.data[0]);
      expect(latestSessionPerChannel['C123']).toBe('sess-456');
    });

    test('should handle no sessions found', async () => {
      // Setup
      const mockResponse = { data: [], error: null };
      supabase.limit.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await getLatestSessionForChannel('C123');
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.session).toBeNull();
    });
  });
});
