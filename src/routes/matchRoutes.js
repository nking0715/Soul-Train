const express = require('express');
const matchController = require('../controllers/matchController');

const router = express.Router();

router.get('/', matchController.getMatchListByUserId);

module.exports = router;