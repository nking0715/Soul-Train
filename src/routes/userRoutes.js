const express = require('express');
const passport = require('passport');
const router = express.Router();
const { register, login } = require('../controllers/userController');
const { check } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

router.post('/verify-google-token', async (req, res) => {
    const idToken = req.body.idToken;

    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
        });
        const payload = ticket.getPayload();
        const userId = payload['sub'];

        // Use the `userId` (or other payload fields) to identify the user in your system.
        // Maybe fetch their profile from MongoDB, or create a new profile if it's their first time logging in.

        res.send({ status: 'success', user: payload });

    } catch (error) {
        res.status(400).send({ status: 'error', message: 'Token verification failed.' });
    }
});

module.exports = router;
