const express = require('express');
const { check } = require('express-validator');

const router = express.Router();

const { getProfile, updateProfile } = require('../controllers/profileController');

router.get('/profile', getProfile);
router.put('/profile', [
    // List of validations
    check('bio').isLength({ max: 500 }).withMessage('Bio should not exceed 500 characters.'),
    check('dateOfBirth').toDate().isISO8601().withMessage('Invalid date of birth.'),
    check('profilePicture').optional().isURL().withMessage('Invalid profile picture URL.'),
    check('location').isLength({ max: 100 }).withMessage('Location should not exceed 100 characters.'),
    check('website').optional().isURL().withMessage('Invalid website URL.'),
], updateProfile);

module.exports = router;
