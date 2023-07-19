const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const authService = require('../services/authService');

// Register a new user
exports.registerUser = async (req, res) => {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Create a new user
    const user = new User({
      email: req.body.email,
      password: hashedPassword,
    });

    // Save the user to the database
    await user.save();

    // Generate a JWT token
    const token = authService.generateToken(user);

    // Return the token to the client
    res.json({ token });
  } catch (err) {
    console.error('Failed to register user', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

// Login an existing user
exports.loginUser = async (req, res) => {
  try {
    // Find the user by email
    const user = await User.findOne({ email: req.body.email });

    // Verify the password
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);

    if (!passwordMatch) {
      throw new Error('Invalid password');
    }

    // Generate a JWT token
    const token = authService.generateToken(user);

    // Return the token to the client
    res.json({ token });
  } catch (err) {
    console.error('Failed to login user', err);
    res.status(401).json({ error: 'Failed to login user' });
  }
};

// Logout the current user
exports.logoutUser = async (req, res) => {
  try {
    // TODO: Implement logout logic
    res.json({ message: 'User logged out' });
  } catch (err) {
    console.error('Failed to logout user', err);
    res.status(500).json({ error: 'Failed to logout user' });
  }
};