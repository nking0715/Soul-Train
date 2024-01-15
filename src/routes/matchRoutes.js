const express = require('express');
const matchController = require('../controllers/matchController');

const router = express.Router();

router.get('/:userId', matchController.getMatchListByUserId);

module.exports = router;