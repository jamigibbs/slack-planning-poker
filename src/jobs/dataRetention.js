/**
 * Data Retention Job
 * 
 * This job deletes database records that are older than the specified number of days
 * to comply with the app's data retention policy.
 */
const { supabase } = require('../db');
const logger = require('../utils/logger');

/**
 * Delete records older than the specified number of days
 * @param {number} days - Number of days to retain data (default: 30)
 * @returns {Promise<{success: boolean, error?: Error}>} Result of the operation
 */
async function cleanupOldData(days = 30) {
  try {
    logger.log(`Starting data retention cleanup job (${days} days retention)...`);
    
    // Calculate the cutoff date based on the specified days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Format date for Supabase query
    const formattedCutoffDate = cutoffDate.toISOString();
    
    logger.log(`Cutoff date: ${formattedCutoffDate}`);
    
    // First, identify old sessions
    const { data: oldSessions, error: findError } = await supabase
      .from('sessions')
      .select('id')
      .lt('created_at', formattedCutoffDate);
      
    if (findError) {
      logger.error('Error finding old sessions:', findError);
      return { success: false, error: findError };
    }
    
    if (!oldSessions || oldSessions.length === 0) {
      logger.log(`No sessions found older than ${formattedCutoffDate}`);
      return { success: true };
    }
    
    logger.log(`Found ${oldSessions.length} sessions older than ${formattedCutoffDate}`);
    
    // Extract session IDs
    const oldSessionIds = oldSessions.map(session => session.id);
    
    // Delete votes for those sessions first
    const { error: votesError } = await supabase
      .from('votes')
      .delete()
      .in('session_id', oldSessionIds);
      
    if (votesError) {
      logger.error('Error deleting votes for old sessions:', votesError);
      return { success: false, error: votesError };
    }
    
    logger.log(`Successfully deleted votes for ${oldSessionIds.length} old sessions`);
    
    // Now delete the sessions themselves
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .in('id', oldSessionIds);
      
    if (sessionsError) {
      logger.error('Error deleting old sessions:', sessionsError);
      return { success: false, error: sessionsError };
    }
    
    logger.log(`Successfully deleted ${oldSessionIds.length} old sessions`);
    
    // Also delete any orphaned votes older than the cutoff date
    // (votes that might not be associated with any session)
    const { error: orphanedVotesError } = await supabase
      .from('votes')
      .delete()
      .lt('created_at', formattedCutoffDate);
      
    if (orphanedVotesError) {
      logger.error('Error deleting orphaned votes:', orphanedVotesError);
      // Non-critical error, continue
    } else {
      logger.log(`Successfully deleted any orphaned votes older than ${formattedCutoffDate}`);
    }
    
    logger.log('Data retention cleanup job completed successfully');
    return { success: true };
  } catch (error) {
    logger.error('Error in data retention job:', error);
    return { success: false, error };
  }
}

// If this file is run directly (e.g., from a scheduled job)
if (require.main === module) {
  cleanupOldData()
    .then(result => {
      logger.log('Job execution result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      logger.error('Unhandled error in job execution:', err);
      process.exit(1);
    });
}

module.exports = {
  cleanupOldData
};
