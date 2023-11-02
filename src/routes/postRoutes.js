const express = require('express');
const router = express.Router();

const { commentPost, editComment, deleteComment } = require('../controllers/postController');

router.post('/comment', commentPost)
router.put('/comment', editComment)
router.delete('/comment', deleteComment)

module.exports = router;
