var express = require('express');
var router = express.Router();

const v1Router = require('./v1-api-router');

router.use("/v1", v1Router)

module.exports = router;