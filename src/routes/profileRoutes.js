const express = require('express');
const { check } = require('express-validator');
const multer = require('multer');

const router = express.Router();

const { getProfile, updateProfile, uploadPost, getUploadedContents, uploadProfilePicture, uploadCoverPicture, connectDancer, acceptDancer, followManage, addNumberOfViews, getFollowerList, getFollowingList } = require('../controllers/profileController');


const mimeToExt = {
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'video/x-matroska': '.mkv',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/tiff': '.tiff',
    // ... add other types as needed
};

router.get('/', getProfile);
router.get('/:userId', getProfile);

router.put('/', [
    // Existing validations
    check('username').optional().isLength({ max: 30 }).withMessage('User name should not exceed 30 characters.'),
    check('bio').isLength({ max: 500 }).withMessage('Bio should not exceed 500 characters.'),
    check('profilePicture').optional().isURL().withMessage('Invalid profile picture URL.'),
    check('artistName').notEmpty().withMessage('Artist name is required.'),
    check('coverPicture').optional().isURL().withMessage('Invalid cover picture URL.'),
    check('crew').optional().isLength({ max: 500 }).withMessage('Crew info should not exceed 500 characters.'),
    check('email').optional().isEmail().withMessage('Invalid email address.'),
    check('phoneNumber').optional().isLength({ max: 20 }).withMessage('Phone number should not exceed 20 characters.'),
], updateProfile);

router.post('/uploadPost', uploadPost)
router.post('/uploadProfilePicture', uploadProfilePicture)
router.post('/uploadCoverPicture', uploadCoverPicture)
router.post('/getUploadedContents', getUploadedContents)
router.post('/addNumberOfViews', addNumberOfViews)

router.post('/connect_dancer', connectDancer);
router.post('/accept_dancer', acceptDancer);
router.post('/follow', followManage)
router.post('/getfollowerList', getFollowerList)
router.post('/getfollowingList', getFollowingList)

module.exports = router;
