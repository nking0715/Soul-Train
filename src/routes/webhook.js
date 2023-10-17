const express = require('express');
const agoraController = require('../controllers/agoraController');
const verifyWebhookKey = require('../middlewares/verifyWebhookKey');

const router = express.Router();

router.post('/', verifyWebhookKey.verifyWebhookKey, agoraController.contentModerationWebhook);

module.exports = router;