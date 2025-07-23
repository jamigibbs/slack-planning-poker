/**
 * Tests for the data retention job
 */
const { cleanupOldData } = require('../../src/jobs/dataRetention');
const { supabase } = require('../../src/db');
const logger = require('../../src/utils/logger');

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

// Mock the Supabase client
jest.mock('../../src/db', () => {
  const mockDelete = jest.fn().mockReturnThis();
  const mockLt = jest.fn().mockResolvedValue({ data: [], error: null });
  const mockIn = jest.fn().mockResolvedValue({ data: [], error: null });
  const mockSelect = jest.fn().mockReturnThis();
  
  return {
    supabase: {
      from: jest.fn().mockReturnValue({
        delete: mockDelete,
        lt: mockLt,
        in: mockIn,
        select: mockSelect
      })
    }
  };
});

describe('Data Retention Job', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should delete votes older than 30 days by default', async () => {
    // Mock sessions query
    const oldSessions = [{ id: 'sess-1' }, { id: 'sess-2' }];
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: oldSessions, error: null });
    
    // Mock votes deletion
    const votesInSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock sessions deletion
    const sessionsInSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock orphaned votes deletion
    const orphanedVotesLtSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));
    
    // Setup the mock chain for deleting votes by session IDs
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: votesInSpy
    }));
    
    // Setup the mock chain for deleting sessions
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: sessionsInSpy
    }));
    
    // Setup the mock chain for deleting orphaned votes
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      lt: orphanedVotesLtSpy
    }));

    // Call the function
    const result = await cleanupOldData();

    // Verify the correct tables were queried
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'sessions');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'votes');
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'sessions');
    expect(supabase.from).toHaveBeenNthCalledWith(4, 'votes');
    
    // Verify select was called for sessions
    expect(selectSpy).toHaveBeenCalledWith('id');
    
    // Verify the session IDs were used for deleting votes
    expect(votesInSpy).toHaveBeenCalledWith('session_id', ['sess-1', 'sess-2']);
    
    // Verify the session IDs were used for deleting sessions
    expect(sessionsInSpy).toHaveBeenCalledWith('id', ['sess-1', 'sess-2']);
    
    // Verify the result
    expect(result).toEqual({ success: true });
  });

  test('should accept custom days parameter', async () => {
    // Mock sessions query
    const oldSessions = [{ id: 'sess-1' }];
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: oldSessions, error: null });
    
    // Mock votes deletion
    const votesInSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock sessions deletion
    const sessionsInSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock orphaned votes deletion
    const orphanedVotesLtSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));
    
    // Setup the mock chain for deleting votes by session IDs
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: votesInSpy
    }));
    
    // Setup the mock chain for deleting sessions
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: sessionsInSpy
    }));
    
    // Setup the mock chain for deleting orphaned votes
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      lt: orphanedVotesLtSpy
    }));

    // Call the function with custom days parameter (15 days)
    const result = await cleanupOldData(15);

    // Verify the correct tables were queried
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'sessions');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'votes');
    expect(supabase.from).toHaveBeenNthCalledWith(3, 'sessions');
    expect(supabase.from).toHaveBeenNthCalledWith(4, 'votes');
    
    // Verify the result
    expect(result).toEqual({ success: true });
  });

  test('should handle case when no old sessions are found', async () => {
    // Mock sessions query with empty result
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: [], error: null });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));

    // Call the function
    const result = await cleanupOldData();

    // Verify only the sessions query was made
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('sessions');
    
    // Verify the result
    expect(result).toEqual({ success: true });
  });

  test('should handle errors when finding old sessions', async () => {
    // Mock sessions query with error
    const findError = { message: 'Database error' };
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: null, error: findError });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));

    // Call the function
    const result = await cleanupOldData();

    // Verify error was logged
    expect(logger.error).toHaveBeenCalledWith('Error finding old sessions:', findError);
    
    // Verify the function returns failure
    expect(result).toEqual({ success: false, error: findError });
  });

  test('should handle errors when deleting votes', async () => {
    // Mock sessions query
    const oldSessions = [{ id: 'sess-1' }, { id: 'sess-2' }];
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: oldSessions, error: null });
    
    // Mock votes deletion with error
    const votesError = { message: 'Database error' };
    const votesInSpy = jest.fn().mockResolvedValue({ data: null, error: votesError });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));
    
    // Setup the mock chain for deleting votes by session IDs
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: votesInSpy
    }));

    // Call the function
    const result = await cleanupOldData();

    // Verify error was logged
    expect(logger.error).toHaveBeenCalledWith('Error deleting votes for old sessions:', votesError);
    
    // Verify the function returns failure
    expect(result).toEqual({ success: false, error: votesError });
  });

  test('should handle errors when deleting sessions', async () => {
    // Mock sessions query
    const oldSessions = [{ id: 'sess-1' }, { id: 'sess-2' }];
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: oldSessions, error: null });
    
    // Mock votes deletion
    const votesInSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock sessions deletion with error
    const sessionsError = { message: 'Database error' };
    const sessionsInSpy = jest.fn().mockResolvedValue({ data: null, error: sessionsError });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));
    
    // Setup the mock chain for deleting votes by session IDs
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: votesInSpy
    }));
    
    // Setup the mock chain for deleting sessions
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: sessionsInSpy
    }));

    // Call the function
    const result = await cleanupOldData();

    // Verify error was logged
    expect(logger.error).toHaveBeenCalledWith('Error deleting old sessions:', sessionsError);
    
    // Verify the function returns failure
    expect(result).toEqual({ success: false, error: sessionsError });
  });

  test('should handle errors when deleting orphaned votes', async () => {
    // Mock sessions query
    const oldSessions = [{ id: 'sess-1' }];
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: oldSessions, error: null });
    
    // Mock votes deletion
    const votesInSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock sessions deletion
    const sessionsInSpy = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock orphaned votes deletion with error
    const orphanedVotesError = { message: 'Database error' };
    const orphanedVotesLtSpy = jest.fn().mockResolvedValue({ data: null, error: orphanedVotesError });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));
    
    // Setup the mock chain for deleting votes by session IDs
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: votesInSpy
    }));
    
    // Setup the mock chain for deleting sessions
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      in: sessionsInSpy
    }));
    
    // Setup the mock chain for deleting orphaned votes
    supabase.from.mockImplementationOnce(() => ({
      delete: jest.fn().mockReturnThis(),
      lt: orphanedVotesLtSpy
    }));

    // Call the function
    const result = await cleanupOldData();

    // Verify error was logged
    expect(logger.error).toHaveBeenCalledWith('Error deleting orphaned votes:', orphanedVotesError);
    
    // Verify the function still completes successfully (orphaned votes deletion is non-critical)
    expect(result).toEqual({ success: true });
  });

  test('should handle unexpected errors', async () => {
    // Setup mock to throw an exception
    const unexpectedError = new Error('Unexpected error');
    
    supabase.from.mockImplementationOnce(() => {
      throw unexpectedError;
    });

    // Call the function
    const result = await cleanupOldData();

    // Verify error was logged
    expect(logger.error).toHaveBeenCalledWith('Error in data retention job:', unexpectedError);
    
    // Verify the function returns failure
    expect(result).toEqual({ success: false, error: unexpectedError });
  });

  test('should verify cutoff date calculation with default 30 days', async () => {
    // Mock Date to return a fixed date
    const realDate = global.Date;
    const fixedDate = new Date('2025-07-23T00:00:00Z');
    global.Date = class extends Date {
      constructor() {
        super();
        return fixedDate;
      }
    };
    global.Date.now = realDate.now;

    // Mock sessions query
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: [], error: null });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));

    // Call the function
    await cleanupOldData();

    // Expected cutoff date: 30 days before 2025-07-23
    const expectedDate = new Date('2025-06-23T00:00:00Z').toISOString();
    
    // Verify the cutoff date was calculated correctly
    expect(ltSpy).toHaveBeenCalledWith('created_at', expectedDate);
    
    // Restore Date
    global.Date = realDate;
  });

  test('should verify cutoff date calculation with custom days', async () => {
    // Mock Date to return a fixed date
    const realDate = global.Date;
    const fixedDate = new Date('2025-07-23T00:00:00Z');
    global.Date = class extends Date {
      constructor() {
        super();
        return fixedDate;
      }
    };
    global.Date.now = realDate.now;

    // Mock sessions query
    const selectSpy = jest.fn().mockReturnThis();
    const ltSpy = jest.fn().mockResolvedValue({ data: [], error: null });
    
    // Setup the mock chain for finding old sessions
    supabase.from.mockImplementationOnce(() => ({
      select: selectSpy,
      lt: ltSpy
    }));

    // Call the function with custom days parameter (15 days)
    await cleanupOldData(15);

    // Expected cutoff date: 15 days before 2025-07-23
    const expectedDate = new Date('2025-07-08T00:00:00Z').toISOString();
    
    // Verify the cutoff date was calculated correctly
    expect(ltSpy).toHaveBeenCalledWith('created_at', expectedDate);
    
    // Restore Date
    global.Date = realDate;
  });
});
