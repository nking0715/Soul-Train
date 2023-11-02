const express = require('express');
const router = express.Router();

const { createPost, commentPost, editComment, deleteComment } = require('../controllers/postController');

router.post('/', createPost);
router.post('/comment', commentPost);
router.put('/comment', editComment);
router.delete('/comment/:commentId', deleteComment);

module.exports = router;