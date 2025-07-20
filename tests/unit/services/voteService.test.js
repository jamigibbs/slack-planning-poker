const { 
  saveVote,
  getSessionVotes,
  countVotes
} = require('../../../src/services/voteService');

// Mock Supabase with proper method chaining
jest.mock('../../../src/db/supabase', () => {
  const mockSupabase = {
    from: jest.fn(),
    upsert: jest.fn(),
    select: jest.fn(),
    eq: jest.fn(),
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

describe('Vote Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mocks to return the mock object for chaining
    Object.keys(supabase).forEach(key => {
      if (typeof supabase[key] === 'function') {
        supabase[key].mockReturnValue(supabase);
      }
    });
  });

  describe('saveVote', () => {
    test('should save a vote successfully', async () => {
      // Setup
      const mockResponse = { error: null };
      supabase.upsert.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await saveVote('sess-123', 'U123', 5, 'testuser');
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('votes');
      expect(supabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess-123',
          user_id: 'U123',
          vote: 5,
          username: 'testuser'
        }),
        expect.objectContaining({
          onConflict: 'session_id,user_id',
          returning: 'minimal'
        })
      );
      expect(result.success).toBe(true);
    });

    test('should handle database errors', async () => {
      // Setup
      const mockError = { error: { message: 'Database error' } };
      supabase.upsert.mockResolvedValue(mockError);
      
      // Execute
      const result = await saveVote('sess-123', 'U123', 5, 'testuser');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.error);
    });
  });

  describe('getSessionVotes', () => {
    test('should get votes and session data', async () => {
      // Setup
      const mockVotesResponse = { 
        data: [
          { session_id: 'sess-123', user_id: 'U1', vote: 3, username: 'user1' },
          { session_id: 'sess-123', user_id: 'U2', vote: 5, username: 'user2' }
        ],
        error: null 
      };
      const mockSessionResponse = {
        data: [{ id: 'sess-123', issue: 'Test issue' }],
        error: null
      };
      
      // Mock the queries - votes resolves at .eq(), session resolves at .limit()
      supabase.eq.mockResolvedValueOnce(mockVotesResponse);  // First .eq() call for votes
      supabase.limit.mockResolvedValueOnce(mockSessionResponse); // Session query resolves at .limit()
      
      // Execute
      const result = await getSessionVotes('sess-123');
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('votes');
      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(supabase.select).toHaveBeenCalledWith('*');
      expect(supabase.eq).toHaveBeenCalledWith('session_id', 'sess-123');
      expect(supabase.eq).toHaveBeenCalledWith('id', 'sess-123');
      expect(supabase.limit).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
      expect(result.votes).toEqual(mockVotesResponse.data);
      expect(result.session).toEqual(mockSessionResponse.data[0]);
    });

    test('should handle session not found', async () => {
      // Setup
      const mockVotesResponse = { 
        data: [
          { session_id: 'sess-123', user_id: 'U1', vote: 3, username: 'user1' }
        ],
        error: null 
      };
      const mockSessionResponse = { data: [], error: null };
      
      supabase.eq.mockResolvedValueOnce(mockVotesResponse);
      supabase.limit.mockResolvedValueOnce(mockSessionResponse);
      
      // Execute
      const result = await getSessionVotes('sess-123');
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.votes).toEqual(mockVotesResponse.data);
      expect(result.session).toBeNull();
    });

    test('should handle error fetching votes', async () => {
      // Setup
      const mockVotesError = { 
        data: null,
        error: { message: 'Database error fetching votes' }
      };
      
      supabase.eq.mockResolvedValueOnce(mockVotesError);
      
      // Execute
      const result = await getSessionVotes('sess-123');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockVotesError.error);
      expect(result.votes).toBeNull();
    });

    test('should handle error fetching session', async () => {
      // Setup
      const mockVotesResponse = { 
        data: [{ session_id: 'sess-123', user_id: 'U1', vote: 3 }],
        error: null 
      };
      const mockSessionError = { 
        data: null,
        error: { message: 'Database error fetching session' }
      };
      
      supabase.eq.mockResolvedValueOnce(mockVotesResponse);
      supabase.limit.mockResolvedValueOnce(mockSessionError);
      
      // Execute
      const result = await getSessionVotes('sess-123');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockSessionError.error);
      expect(result.session).toBeNull();
      expect(result.votes).toBeNull();
    });

    test('should handle exceptions in getSessionVotes', async () => {
      // Setup - mock to throw an exception
      supabase.eq.mockRejectedValue(new Error('Database connection failed'));
      
      // Execute
      const result = await getSessionVotes('sess-123');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Database connection failed');
      expect(result.session).toBeNull();
      expect(result.votes).toBeNull();
    });
  });

  describe('countVotes', () => {
    test('should count votes for a session', async () => {
      // Setup
      const mockResponse = { count: 3, error: null };
      supabase.eq.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await countVotes('sess-123');
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('votes');
      expect(supabase.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(supabase.eq).toHaveBeenCalledWith('session_id', 'sess-123');
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
    });

    test('should handle database errors', async () => {
      // Setup
      const mockError = { error: { message: 'Database error' }, count: null };
      supabase.eq.mockResolvedValue(mockError);
      
      // Execute
      const result = await countVotes('sess-123');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.error);
      expect(result.count).toBe(0);
    });
  });
});
