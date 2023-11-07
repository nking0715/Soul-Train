const express = require('express');
const router = express.Router();

const { createPost, getPost, deletePost, commentPost, editComment, deleteComment, getComment, likeComment,savePost, getSavedPost, reportContent, discoverPosts, homeFeed, likePost } = require('../controllers/postController');

router.post('/', createPost);
router.get('/', getPost);
router.delete('/', deletePost)
router.post('/comment', commentPost);
router.put('/comment', editComment);
router.delete('/comment', deleteComment);
router.get('/comment', getComment);
router.put('/comment/like', likeComment);

router.post('/savePost', savePost);
router.get('/getSavedPost', getSavedPost);
router.post('/report', reportContent);
router.get("/discover", discoverPosts);
router.get("/homeFeed", homeFeed);
router.put('/like', likePost);

module.exports = router;
