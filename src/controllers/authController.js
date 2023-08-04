const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const authService = require('../services/authService');

// Register a new user
exports.registerUser = async (req, res) => {
  try {
    // Check if the user already exists
    let user = await User.findOne({ email: req.body.email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
        token: "",
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // Create a new user object
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });

    // Save the user to the database
    await newUser.save();

    // Generate a JWT token
    const token = authService.generateToken(newUser);

    // Return the token to the client
    res.status(200).json({ success: true, message: 'User registered successfully', token: token });
  } catch (err) {
    console.error('Failed to register user', err);
    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      token: "",
    });
  }
};

// Login an existing user
exports.loginUser = async (req, res) => {
  try {
    // Find the user by email
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User doesn't exist.",
        token: "",
      });
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(req.body.password, user.password);

    if (!passwordMatch) {
      return res.status(400).json({
        success: false,
        message: "Password incorrect.",
        token: "",
      });
    }

    // Generate a JWT token
    const token = authService.generateToken(user);

    // Return the token to the client
    res.status(200).json({ success: true, message: 'User logged in successfully', token: token });
  } catch (err) {
    console.error('Failed to login user', err);
    res.status(401).json({ success: true, message: 'Unknow error', token: ''});
  }
};