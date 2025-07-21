const axios = require('axios');
const { saveTeamInstallation, getTeamInstallation } = require('../services/teamService');
const logger = require('../utils/logger');

/**
 * Initiate OAuth flow - redirect user to Slack authorization
 */
async function initiateOAuth(req, res) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.BASE_URL}/slack/oauth/callback`;
  const scopes = 'commands,chat:write,reactions:write,channels:read,groups:read,im:read,mpim:read';
  
  const authUrl = `https://slack.com/oauth/v2/authorize?` +
    `client_id=${clientId}&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.redirect(authUrl);
}

/**
 * Handle OAuth callback from Slack
 */
async function handleOAuthCallback(req, res) {
  const { code, error } = req.query;
  
  if (error) {
    logger.error('OAuth error:', error);
    return res.status(400).send(`OAuth Error: ${error}`);
  }
  
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  
  try {
    // Exchange code for access token
    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      code: code,
      redirect_uri: `${process.env.BASE_URL}/slack/oauth/callback`
    });
    
    const tokenResponse = await axios.post('https://slack.com/api/oauth.v2.access', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const { data } = tokenResponse;
    
    if (!data.ok) {
      logger.error('Token exchange failed:', data.error);
      return res.status(400).send(`Token exchange failed: ${data.error}`);
    }
    
    // Extract installation data
    const installation = {
      team_id: data.team.id,
      team_name: data.team.name,
      bot_token: data.access_token,
      bot_user_id: data.bot_user_id,
      scope: data.scope,
      installed_at: new Date().toISOString(),
      installer_user_id: data.authed_user?.id,
      app_id: data.app_id
    };
    
    // Save installation to database
    const saveResult = await saveTeamInstallation(installation);
    
    if (!saveResult.success) {
      logger.error('Failed to save installation:', saveResult.error);
      return res.status(500).send('Failed to save installation');
    }
    
    // Redirect to success page
    res.redirect('/slack/oauth/success');
    
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.status(500).send('Internal server error during OAuth');
  }
}

/**
 * OAuth success page
 */
async function oauthSuccess(req, res) {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Planning Poker - Installation Success</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px;
          background-color: #f8f9fa;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .success-icon { font-size: 48px; color: #28a745; margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; margin-bottom: 15px; }
        .commands { 
          background: #f8f9fa; 
          padding: 20px; 
          border-radius: 4px; 
          margin: 20px 0;
          text-align: left;
        }
        code { 
          background: #e9ecef; 
          padding: 2px 6px; 
          border-radius: 3px; 
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">🎉</div>
        <h1>Planning Poker Installed Successfully!</h1>
        <p>Great! Planning Poker has been installed to your Slack workspace.</p>
        
        <div class="commands">
          <h3>Available Commands:</h3>
          <p><code>/poker [issue link or description]</code> - Start a new planning poker session</p>
          <p><code>/poker-reveal</code> - Reveal votes for the current session</p>
        </div>
        
        <p>You can now use Planning Poker in any channel where the bot has been invited.</p>
        <p>Happy estimating! 🎯</p>
      </div>
    </body>
    </html>
  `);
}

/**
 * Get bot token for a specific team
 */
async function getBotTokenForTeam(teamId) {
  const installation = await getTeamInstallation(teamId);
  return installation?.success ? installation.installation.bot_token : null;
}

module.exports = {
  initiateOAuth,
  handleOAuthCallback,
  oauthSuccess,
  getBotTokenForTeam
};
