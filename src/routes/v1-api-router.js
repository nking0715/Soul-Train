var express = require('express');
var router = express.Router();
const { discoverBlockedContents } = require("../controllers/discoverController");

// App Backend Router
router.post("/discover/blocked-contents", discoverBlockedContents);

module.exports = router;
