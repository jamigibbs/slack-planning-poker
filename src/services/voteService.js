const supabase = require('../db/supabase');

/**
 * Save a vote to the database
 * @param {string} sessionId - The session ID
 * @param {string} userId - The user ID
 * @param {number} vote - The vote value
 * @param {string} username - The username
 * @returns {Promise<Object>} Result of the operation
 */
async function saveVote(sessionId, userId, vote, username) {
  try {
    // Use upsert operation with on_conflict to update existing votes
    const { error } = await supabase
      .from('votes')
      .upsert({ 
        session_id: sessionId, 
        user_id: userId, 
        vote: vote,
        username: username
      }, {
        onConflict: 'session_id,user_id',
        returning: 'minimal'
      });
      
    if (error) {
      console.error('Error saving vote:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Exception saving vote:', err);
    return { success: false, error: err };
  }
}

/**
 * Get all votes for a session
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object>} Result with votes and session data
 */
async function getSessionVotes(sessionId) {
  try {
    // Get votes for the session
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error fetching votes:', error);
      return { success: false, error, votes: null };
    }

    // Get session details
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .limit(1);
    
    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return { success: false, error: sessionError, session: null, votes: null };
    }
    
    if (!sessionData || sessionData.length === 0) {
      return { success: true, session: null, votes: data };
    }
    
    return { success: true, session: sessionData[0], votes: data };
  } catch (err) {
    console.error('Exception fetching votes:', err);
    return { success: false, error: err, session: null, votes: null };
  }
}

/**
 * Count votes for a session
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object>} Result with vote count
 */
async function countVotes(sessionId) {
  try {
    const { count, error } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
      
    if (error) {
      console.error('Error counting votes:', error);
      return { success: false, error, count: 0 };
    }
    
    return { success: true, count };
  } catch (err) {
    console.error('Exception counting votes:', err);
    return { success: false, error: err, count: 0 };
  }
}

module.exports = {
  saveVote,
  getSessionVotes,
  countVotes
};
