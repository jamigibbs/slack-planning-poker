const supabase = require('../db/supabase');
const logger = require('../utils/logger');

/**
 * Save team installation data
 * @param {Object} installation - Installation data from Slack OAuth
 * @returns {Promise<Object>} Result of the operation
 */
async function saveTeamInstallation(installation) {
  try {
    const { error } = await supabase
      .from('team_installations')
      .upsert({
        team_id: installation.team_id,
        team_name: installation.team_name,
        bot_token: installation.bot_token,
        bot_user_id: installation.bot_user_id,
        scope: installation.scope,
        installed_at: installation.installed_at,
        installer_user_id: installation.installer_user_id,
        app_id: installation.app_id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'team_id',
        returning: 'minimal'
      });
    
    if (error) {
      logger.error('Error saving team installation:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Exception in saveTeamInstallation:', error);
    return { success: false, error };
  }
}

/**
 * Get team installation data
 * @param {string} teamId - Slack team ID
 * @returns {Promise<Object>} Installation data or null
 */
async function getTeamInstallation(teamId) {
  try {
    const { data, error } = await supabase
      .from('team_installations')
      .select('*')
      .eq('team_id', teamId)
      .limit(1);
    
    if (error) {
      logger.error('Error getting team installation:', error);
      return { success: false, error, installation: null };
    }
    
    if (!data || data.length === 0) {
      return { success: true, installation: null };
    }
    
    return { success: true, installation: data[0] };
  } catch (error) {
    logger.error('Exception in getTeamInstallation:', error);
    return { success: false, error, installation: null };
  }
}

/**
 * Remove team installation (for uninstalls)
 * @param {string} teamId - Slack team ID
 * @returns {Promise<Object>} Result of the operation
 */
async function removeTeamInstallation(teamId) {
  try {
    const { error } = await supabase
      .from('team_installations')
      .delete()
      .eq('team_id', teamId);
    
    if (error) {
      logger.error('Error removing team installation:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Exception in removeTeamInstallation:', error);
    return { success: false, error };
  }
}

/**
 * List all team installations
 * @returns {Promise<Object>} List of installations
 */
async function listTeamInstallations() {
  try {
    const { data, error } = await supabase
      .from('team_installations')
      .select('team_id, team_name, installed_at, scope')
      .order('installed_at', { ascending: false });
    
    if (error) {
      logger.error('Error listing team installations:', error);
      return { success: false, error, installations: [] };
    }
    
    return { success: true, installations: data || [] };
  } catch (error) {
    logger.error('Exception in listTeamInstallations:', error);
    return { success: false, error, installations: [] };
  }
}

module.exports = {
  saveTeamInstallation,
  getTeamInstallation,
  removeTeamInstallation,
  listTeamInstallations
};
