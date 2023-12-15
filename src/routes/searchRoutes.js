var express = require('express');
var router = express.Router();

const { search } = require('../controllers/searchController');

router.get('/', search);

module.exports = router;
