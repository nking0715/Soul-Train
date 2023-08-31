const express = require('express');
const router = express.Router();
const { register, verifyValidationCode, login, googleLogin, addArtistName, facebookLogin, logout } = require('../controllers/userController');
const { check } = require('express-validator');

router.post('/register', [
    check('username').notEmpty().withMessage('Username is required.'),
    check('artistName').notEmpty().withMessage('Artist name is required.'),
    check('email').isEmail().withMessage('Invalid email format.'),
    check('password')
        .isLength({ min: 7 }).withMessage('Password must be longer than 6 characters.')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
        .matches(/[0-9]/).withMessage('Password must contain at least one number.')
        .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character.')
], register);

router.post('/verifyValidationCode', verifyValidationCode);
router.post('/login', login);
router.post('/verify-google-token', googleLogin);
router.post('/add-artist-name/:userId', addArtistName);
router.post('/facebookLogin', facebookLogin);
router.post('/logout', logout);

module.exports = router;
