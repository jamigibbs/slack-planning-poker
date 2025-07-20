const supabase = require('../db/supabase');

// Track the latest session ID per channel in memory
const latestSessionPerChannel = {};

/**
 * Create a new planning poker session
 * @param {string} channelId - The channel ID
 * @param {string} issue - The issue text
 * @returns {Promise<Object>} Result with session ID
 */
async function createSession(channelId, issue) {
  try {
    // Generate a unique session ID
    const sessionId = `sess-${Date.now()}`;
    
    // Save the session to Supabase
    const { error } = await supabase
      .from('sessions')
      .insert({ 
        id: sessionId, 
        channel: channelId, 
        issue: issue,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error creating session:', error);
      }
      return { success: false, error, sessionId: null };
    }
    
    // Update the in-memory cache
    latestSessionPerChannel[channelId] = sessionId;
    
    return { success: true, sessionId };
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Exception creating session:', err);
    }
    return { success: false, error: err, sessionId: null };
  }
}

/**
 * Get the latest session for a channel
 * @param {string} channelId - The channel ID
 * @returns {Promise<Object>} Result with session data
 */
async function getLatestSessionForChannel(channelId) {
  try {
    // Check in-memory cache first
    if (latestSessionPerChannel[channelId]) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', latestSessionPerChannel[channelId])
        .limit(1);
      
      if (!error && data && data.length > 0) {
        return { success: true, session: data[0] };
      }
      // If not found, continue to query by channel
    }
    
    // Query the database for the latest session
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('channel', channelId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error fetching latest session:', error);
      }
      return { success: false, error, session: null };
    }
    
    if (!data || data.length === 0) {
      return { success: true, session: null };
    }
    
    // Update the in-memory cache
    latestSessionPerChannel[channelId] = data[0].id;
    
    return { success: true, session: data[0] };
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Exception fetching latest session:', err);
    }
    return { success: false, error: err, session: null };
  }
}

/**
 * Clean up old sessions and their votes
 * @param {number} days - Number of days to keep sessions for
 * @returns {Promise<Object>} Result with count of deleted items
 */
async function cleanupOldSessions(days = 30) {
  try {
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Get sessions older than the cutoff date
    const { data: oldSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id')
      .lt('created_at', cutoffDate.toISOString());
    
    if (sessionsError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error fetching old sessions:', sessionsError);
      }
      return { 
        success: false, 
        error: sessionsError,
        deletedSessions: 0,
        deletedVotes: 0
      };
    }
    
    if (!oldSessions || oldSessions.length === 0) {
      return { 
        success: true, 
        deletedSessions: 0,
        deletedVotes: 0,
        message: 'No old sessions found to delete'
      };
    }
    
    const sessionIds = oldSessions.map(session => session.id);
    
    // Delete votes for these sessions first
    const { error: votesError, count: votesDeleted } = await supabase
      .from('votes')
      .delete({ count: true })
      .in('session_id', sessionIds);
    
    if (votesError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error deleting votes:', votesError);
      }
      return { 
        success: false, 
        error: votesError,
        deletedSessions: 0,
        deletedVotes: 0
      };
    }
    
    // Then delete the sessions
    const { error: deleteError, count: sessionsDeleted } = await supabase
      .from('sessions')
      .delete({ count: true })
      .in('id', sessionIds);
    
    if (deleteError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error deleting sessions:', deleteError);
      }
      return { 
        success: false, 
        error: deleteError,
        deletedSessions: 0,
        deletedVotes: votesDeleted || 0
      };
    }
    
    return { 
      success: true, 
      deletedSessions: sessionsDeleted || 0,
      deletedVotes: votesDeleted || 0,
      message: `Successfully deleted ${sessionsDeleted} sessions and ${votesDeleted} votes`
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Exception cleaning up sessions:', err);
    }
    return { 
      success: false, 
      error: err,
      deletedSessions: 0,
      deletedVotes: 0
    };
  }
}

module.exports = {
  createSession,
  getLatestSessionForChannel,
  cleanupOldSessions,
  latestSessionPerChannel
};
