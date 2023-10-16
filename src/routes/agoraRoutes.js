const express = require('express');
const agoraController = require('../controllers/agoraController');

const router = express.Router();

router.post('/createChannel', agoraController.createChannel);
router.get('/getChannels', agoraController.getChannels);
router.post('/joinChannel', agoraController.joinChannel);
router.get('/deleteChannel', agoraController.deleteChannel);
router.post('/contentModerationWebhook', agoraController.contentModerationWebhook);

module.exports = router;