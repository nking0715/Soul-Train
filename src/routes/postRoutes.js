const express = require('express');
const router = express.Router();

const { createPost, commentPost, editComment, deleteComment, getComment, savePost, getSavedPost, reportContent } = require('../controllers/postController');

router.post('/', createPost);
router.post('/comment', commentPost);
router.put('/comment', editComment);
router.delete('/comment', deleteComment);
router.get('/comment', getComment);
router.post('/savePost', savePost);
router.get('/getSavedPost', getSavedPost);
router.post('/report', reportContent);

module.exports = router;
