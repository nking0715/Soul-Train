const express = require('express');
const agoraController = require('../controllers/agoraController');

const router = express.Router();

router.post('/createChannel', agoraController.createChannel);
router.get('/getChannels', agoraController.getChannels);
router.post('/joinChannel', agoraController.joinChannel);

module.exports = router;