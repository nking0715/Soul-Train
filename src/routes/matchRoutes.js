const express = require('express');
const matchController = require('../controllers/matchController');
const verifyWebhookKey = require('../middlewares/verifyWebhookKey');

const router = express.Router();

router.post('/getMatchList', matchController.getMatchList);

module.exports = router;