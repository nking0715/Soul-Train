var express = require('express');
var router = express.Router();
const { discoverBlockedContents } = require("../controllers/discoverController");
const { search } = require('../controllers/userController');

// App Backend Router
router.post("/discover/blocked-contents", discoverBlockedContents);
router.get('/search', search);

module.exports = router;
