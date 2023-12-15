var express = require('express');
var router = express.Router();
const { discoverBlockedContents } = require("../controllers/discoverController");
const { searchDancers } = require('../controllers/userController');

// App Backend Router
router.post("/discover/blocked-contents", discoverBlockedContents);
router.post('/search', searchDancers);

module.exports = router;
