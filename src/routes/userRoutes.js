const express = require('express');
const passport = require('passport');
const router = express.Router();
const { register, login } = require('../controllers/userController');
const { check } = require('express-validator');

router.post('/register', [
    check('username').notEmpty().withMessage('Username is required.'),
    check('email').isEmail().withMessage('Invalid email format.'),
    check('password')
        .isLength({ min: 7 }).withMessage('Password must be longer than 6 characters.')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
        .matches(/[0-9]/).withMessage('Password must contain at least one number.')
        .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character.')
], register);

router.post('/login', login);

router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/users/login' }), (req, res) => {
    // Successful authentication, redirect to profile or dashboard.
    res.redirect('/profile');  // Modify this based on your app's needs.
});

module.exports = router;
