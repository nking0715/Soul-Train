var express = require('express');
var router = express.Router();
const { discoverContents, homeFeed, discoverBlockedContents, likeContent } = require("../controllers/discoverController");
const { searchDancers } = require('../controllers/userController');

// App Backend Router
router.post("/homeFeed", homeFeed);
router.post("/discover/blocked-contents", discoverBlockedContents);
router.post('/search/:searchText', searchDancers);
router.post('/likeContent', likeContent);

module.exports = router;
