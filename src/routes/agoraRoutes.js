const express = require('express');
const agoraController = require('../controllers/agoraController');
const verifyWebhookKey = require('../middlewares/verifyWebhookKey');

const router = express.Router();

router.post('/createChannel', agoraController.createChannel);
router.get('/getChannels', agoraController.getChannels);
router.post('/joinChannel', agoraController.joinChannel);
router.get('/deleteChannel', agoraController.deleteChannel);

module.exports = router;