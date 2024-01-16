const express = require('express');
const matchController = require('../controllers/matchController');

const router = express.Router();

router.get('/myProfile', matchController.getMatchListByUserId);

module.exports = router;