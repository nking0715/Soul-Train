const express = require('express');
const matchController = require('../controllers/matchController');

const router = express.Router();


// get the matchList by userId
router.get('/', matchController.getMatchListByUserId);
// get the matchList by user's followers (friends in home screen)
router.get('/homeScreen', matchController.getMatchListWithFriends);
// get the matchList by user's discovery (matchmaking list in discovery)
router.get('/discovery', matchController.getMatchListByDiscovery);

module.exports = router;