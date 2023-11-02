const express = require('express');
const router = express.Router();

const { createPost, commentPost, editComment, deleteComment, getComment, savePost } = require('../controllers/postController');

router.post('/', createPost);
router.post('/comment', commentPost);
router.put('/comment', editComment);
router.delete('/comment/:commentId', deleteComment);
router.post('/getComment', getComment);
router.post('/savePost', savePost);

module.exports = router;
