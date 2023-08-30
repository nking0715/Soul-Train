var express = require('express');
var router = express.Router();
const { discoverContents } = require("../controllers/discoverController");

// App Backend Router
router.post("/discover/contents/:type", discoverContents);

module.exports = router;
