const express = require('express');
const nocache = require('../middleware/nocache');
const agoraController = require('../controllers/agoraController');

const router = express.Router();

router.get('/access_token', nocache, agoraController.generateAccessToken);

module.exports = router;