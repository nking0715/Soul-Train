const express = require('express');
const agoraController = require('../controllers/agoraController');

const router = express.Router();

router.post('/createChannel', agoraController.createChannel);

module.exports = router;