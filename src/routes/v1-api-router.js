var express = require('express');
var router = express.Router();
const { discoverContents } = require("../controllers/discoverController");
const { searchDancers } = require('../controllers/userController');

// App Backend Router
router.post("/discover/contents", discoverContents);
router.post('/search', searchDancers)

module.exports = router;
