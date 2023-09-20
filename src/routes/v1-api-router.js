var express = require('express');
var router = express.Router();
const { discoverContents, discoverBlockedContents } = require("../controllers/discoverController");
const { searchDancers } = require('../controllers/userController');

// App Backend Router
router.post("/discover/contents", discoverContents);
router.post("/discover/blocked-contents", discoverBlockedContents);
router.post('/search/:searchText', searchDancers)

module.exports = router;
