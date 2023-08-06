const express = require('express');
const nocache = require('../middlewares/nocache');
const agoraController = require('../controllers/agoraController');

const router = express.Router();

router.post('/access_token', nocache, agoraController.generateAccessToken);

module.exports = router;