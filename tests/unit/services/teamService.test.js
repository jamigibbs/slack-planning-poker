const { 
  saveTeamInstallation, 
  getTeamInstallation, 
  removeTeamInstallation, 
  listTeamInstallations 
} = require('../../../src/services/teamService');

// Mock Supabase with proper method chaining
jest.mock('../../../src/db/supabase', () => {
  const mockSupabase = {
    from: jest.fn(),
    upsert: jest.fn(),
    select: jest.fn(),
    eq: jest.fn(),
    limit: jest.fn(),
    delete: jest.fn(),
    order: jest.fn(),
    single: jest.fn()
  };
  
  // Make all methods return the same mock object for chaining
  Object.keys(mockSupabase).forEach(key => {
    if (typeof mockSupabase[key] === 'function') {
      mockSupabase[key].mockReturnValue(mockSupabase);
    }
  });
  
  return mockSupabase;
});

const supabase = require('../../../src/db/supabase');

describe('Team Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mock methods to return the mock object for chaining
    Object.keys(supabase).forEach(key => {
      if (typeof supabase[key] === 'function') {
        supabase[key].mockReturnValue(supabase);
      }
    });
  });

  describe('saveTeamInstallation', () => {
    test('should save team installation successfully', async () => {
      // Setup
      const installation = {
        team_id: 'T123456',
        team_name: 'Test Team',
        bot_token: 'xoxb-test-token',
        bot_user_id: 'U123456',
        scope: 'commands,chat:write',
        installed_at: '2024-01-01T00:00:00Z',
        installer_user_id: 'U789012',
        app_id: 'A123456'
      };
      
      const mockResponse = { error: null };
      supabase.upsert.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await saveTeamInstallation(installation);
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('team_installations');
      expect(supabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          team_id: installation.team_id,
          team_name: installation.team_name,
          bot_token: installation.bot_token,
          bot_user_id: installation.bot_user_id,
          scope: installation.scope,
          installed_at: installation.installed_at,
          installer_user_id: installation.installer_user_id,
          app_id: installation.app_id,
          updated_at: expect.any(String)
        }),
        {
          onConflict: 'team_id',
          returning: 'minimal'
        }
      );
      expect(result.success).toBe(true);
    });

    test('should handle database errors', async () => {
      // Setup
      const installation = {
        team_id: 'T123456',
        team_name: 'Test Team',
        bot_token: 'xoxb-test-token',
        bot_user_id: 'U123456',
        scope: 'commands,chat:write',
        installed_at: '2024-01-01T00:00:00Z'
      };
      
      const mockError = { error: { message: 'Database error' } };
      supabase.upsert.mockResolvedValue(mockError);
      
      // Execute
      const result = await saveTeamInstallation(installation);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.error);
    });

    test('should handle exceptions', async () => {
      // Setup
      const installation = { team_id: 'T123456' };
      supabase.upsert.mockRejectedValue(new Error('Connection failed'));
      
      // Execute
      const result = await saveTeamInstallation(installation);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Connection failed');
    });
  });

  describe('getTeamInstallation', () => {
    test('should get team installation successfully', async () => {
      // Setup
      const mockInstallation = {
        team_id: 'T123456',
        team_name: 'Test Team',
        bot_token: 'xoxb-test-token',
        bot_user_id: 'U123456'
      };
      
      const mockResponse = { 
        data: [mockInstallation], 
        error: null 
      };
      supabase.limit.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await getTeamInstallation('T123456');
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('team_installations');
      expect(supabase.select).toHaveBeenCalledWith('*');
      expect(supabase.eq).toHaveBeenCalledWith('team_id', 'T123456');
      expect(supabase.limit).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
      expect(result.installation).toEqual(mockInstallation);
    });

    test('should handle team not found', async () => {
      // Setup
      const mockResponse = { data: [], error: null };
      supabase.limit.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await getTeamInstallation('T123456');
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.installation).toBeNull();
    });

    test('should handle database errors', async () => {
      // Setup
      const mockError = { data: null, error: { message: 'Database error' } };
      supabase.limit.mockResolvedValue(mockError);
      
      // Execute
      const result = await getTeamInstallation('T123456');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.error);
      expect(result.installation).toBeNull();
    });

    test('should handle exceptions', async () => {
      // Setup
      supabase.limit.mockRejectedValue(new Error('Connection failed'));
      
      // Execute
      const result = await getTeamInstallation('T123456');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.installation).toBeNull();
    });
  });

  describe('removeTeamInstallation', () => {
    test('should remove team installation successfully', async () => {
      // Setup
      const mockResponse = { error: null };
      supabase.eq.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await removeTeamInstallation('T123456');
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('team_installations');
      expect(supabase.delete).toHaveBeenCalled();
      expect(supabase.eq).toHaveBeenCalledWith('team_id', 'T123456');
      expect(result.success).toBe(true);
    });

    test('should handle database errors', async () => {
      // Setup
      const mockError = { error: { message: 'Database error' } };
      supabase.eq.mockResolvedValue(mockError);
      
      // Execute
      const result = await removeTeamInstallation('T123456');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.error);
    });

    test('should handle exceptions', async () => {
      // Setup
      supabase.eq.mockRejectedValue(new Error('Connection failed'));
      
      // Execute
      const result = await removeTeamInstallation('T123456');
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('listTeamInstallations', () => {
    test('should list team installations successfully', async () => {
      // Setup
      const mockInstallations = [
        {
          team_id: 'T123456',
          team_name: 'Test Team 1',
          installed_at: '2024-01-01T00:00:00Z',
          scope: 'commands,chat:write'
        },
        {
          team_id: 'T789012',
          team_name: 'Test Team 2',
          installed_at: '2024-01-02T00:00:00Z',
          scope: 'commands,chat:write'
        }
      ];
      
      const mockResponse = { data: mockInstallations, error: null };
      supabase.order.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await listTeamInstallations();
      
      // Assert
      expect(supabase.from).toHaveBeenCalledWith('team_installations');
      expect(supabase.select).toHaveBeenCalledWith('team_id, team_name, installed_at, scope');
      expect(supabase.order).toHaveBeenCalledWith('installed_at', { ascending: false });
      expect(result.success).toBe(true);
      expect(result.installations).toEqual(mockInstallations);
    });

    test('should handle empty results', async () => {
      // Setup
      const mockResponse = { data: null, error: null };
      supabase.order.mockResolvedValue(mockResponse);
      
      // Execute
      const result = await listTeamInstallations();
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.installations).toEqual([]);
    });

    test('should handle database errors', async () => {
      // Setup
      const mockError = { data: null, error: { message: 'Database error' } };
      supabase.order.mockResolvedValue(mockError);
      
      // Execute
      const result = await listTeamInstallations();
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.error);
      expect(result.installations).toEqual([]);
    });

    test('should handle exceptions', async () => {
      // Setup
      supabase.order.mockRejectedValue(new Error('Connection failed'));
      
      // Execute
      const result = await listTeamInstallations();
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.installations).toEqual([]);
    });
  });
});
