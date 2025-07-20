const express = require('express');
const router = express.Router();
const { 
  handlePokerCommand, 
  handlePokerRevealCommand, 
  handleInteractiveActions 
} = require('../controllers/slackController');

// Slack verification endpoint
router.post('/verify', (req, res) => {
  console.log('Received verification request:', req.body);
  res.status(200).json({ challenge: req.body.challenge });
});

// Slack slash commands endpoint
router.post('/commands', async (req, res) => {
  const { command } = req.body;
  
  if (command === '/poker') {
    return handlePokerCommand(req, res);
  } else if (command === '/poker-reveal') {
    return handlePokerRevealCommand(req, res);
  } else {
    return res.status(200).send({
      response_type: "ephemeral",
      text: "This endpoint only handles the /poker and /poker-reveal commands."
    });
  }
});

// Slack interactive actions endpoint
router.post('/actions', async (req, res) => {
  return handleInteractiveActions(req, res);
});

module.exports = router;
