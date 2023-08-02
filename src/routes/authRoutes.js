const express = require('express');
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const validateSchema = require('../middleware/validate-schema');

const router = express.Router();

// Register a new user
router.post(
    '/register',
    [
        check('name', 'Name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Please enter a password with a minimum of 6 characters, including a special character, a digit, and a capital letter')
            .isLength({ min: 6 })
            .matches(/^(?=.*[!@#$%^&*])(?=.*\d)(?=.*[A-Z]).*$/),
    ],
    validateSchema,
    authController.registerUser
);

// Login an existing user
router.post('/login', authController.loginUser);

module.exports = router;