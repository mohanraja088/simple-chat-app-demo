// backend/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const msgCtrl = require('../controllers/messageController');

router.post('/send', msgCtrl.sendMessage);

// If your frontend calls /messages/:myId/:otherId, keep this route:
router.get('/:myId/:otherId', async (req, res) => {
  req.params.from = req.params.myId;
  req.params.to = req.params.otherId;
  return msgCtrl.getPrivateMessages(req, res);
});

module.exports = router;
