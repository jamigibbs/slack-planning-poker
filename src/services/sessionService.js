const supabase = require('../db/supabase');
const logger = require('../utils/logger');

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
      logger.error('Error creating session:', error);
      return { success: false, error, sessionId: null };
    }
    
    // Update the in-memory cache
    latestSessionPerChannel[channelId] = sessionId;
    
    return { success: true, sessionId };
  } catch (error) {
    logger.error('Exception in createSession:', error);
    return { success: false, error, sessionId: null };
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
      logger.error('Error fetching latest session:', error);
      return { success: false, error, session: null };
    }
    
    if (!data || data.length === 0) {
      return { success: true, session: null };
    }
    
    // Update the in-memory cache
    latestSessionPerChannel[channelId] = data[0].id;
    
    return { success: true, session: data[0] };
  } catch (err) {
    logger.error('Exception in getLatestSessionForChannel:', err);
    return { success: false, error: err, session: null };
  }
}

module.exports = {
  createSession,
  getLatestSessionForChannel,
  latestSessionPerChannel
};
