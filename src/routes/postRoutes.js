const express = require('express');
const router = express.Router();

const { commentPost, editComment } = require('../controllers/postController');

router.post('/comment', commentPost)
router.put('/comment', editComment)

module.exports = router;
