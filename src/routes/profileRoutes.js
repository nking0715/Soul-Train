const express = require('express');
const { check } = require('express-validator');

const router = express.Router();

const { getProfile, updateProfile } = require('../controllers/profileController');

router.get('/profile', getProfile);
router.get('/profile/:userId', getProfile);

router.put('/profile', [
    // Existing validations
    check('bio').isLength({ max: 500 }).withMessage('Bio should not exceed 500 characters.'),
    check('profilePicture').optional().isURL().withMessage('Invalid profile picture URL.'),
    check('artistName').notEmpty().withMessage('Artist name is required.'),
    check('coverPicture').optional().isURL().withMessage('Invalid cover picture URL.'),
    check('crew').optional().isLength({ max: 500 }).withMessage('Crew info should not exceed 500 characters.'),
    check('homeLocation').optional().isLength({ max: 200 }).withMessage('Home location should not exceed 200 characters.'),
    check('email').optional().isEmail().withMessage('Invalid email address.'),
    check('phoneNumber').optional().isLength({ max: 20 }).withMessage('Phone number should not exceed 20 characters.'),
], updateProfile);

module.exports = router;
