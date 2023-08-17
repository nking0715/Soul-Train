const User = require('../models/user');
const bcrypt = require('bcryptjs');
const authService = require('../services/authService');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const Profile = require('../models/profile');
require('dotenv').config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let user = await User.findOne({ email: req.body.email });
    if (user) {
      return res.status(400).json({
        message: 'User already exists'
      });
    } else {
      user = new User(req.body);
      await user.save();

      // Create a default profile for the user
      const defaultProfile = new Profile({
        userId: user._id,
        artistName: user.name || 'Unknown Artist'
      });
      await defaultProfile.save();

      req.session.userId = user._id;

      // Generate a JWT token
      const token = authService.generateToken(user);
      // Return the token to the client
      res.status(200).json({ token });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password.' });

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid email or password.' });

    req.session.userId = user._id;

    // Generate a JWT token
    const token = authService.generateToken(user);
    // Return the token to the client
    res.status(200).json({ token });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  const idToken = req.body.idToken;

  try {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;
    let user = await User.findOne({ email: email });
    if (!user) {
      user = new User({ email, name });  // Assuming your User model has fields for email and name
      await user.save();

      // Create a default profile for the user
      const defaultProfile = new Profile({
        userId: user._id,
        artistName: user.name || 'Unknown Artist'
      });
      await defaultProfile.save();
    }

    req.session.userId = userId;

    // Use the `userId` (or other payload fields) to identify the user in your system.
    // Maybe fetch their profile from MongoDB, or create a new profile if it's their first time logging in.

    res.status(200).send({ status: 'success', user: payload });

  } catch (error) {
    res.status(400).send({ status: 'error', message: 'Token verification failed.' });
  }
};

exports.facebookLogin = async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ message: 'Facebook access token is required.' });
  }
  try {
    const axios = require('axios');
    const response = await axios.get(`https://graph.facebook.com/v11.0/me?access_token=${accessToken}&fields=id,name,email`);
    const { id, name, email } = response.data;
    if (!id || !email) {
      return res.status(400).json({ message: 'Failed to fetch user details from Facebook.' });
    }
    let user = await User.findOne({ email: email });
    if (!user) {
      user = new User({ email, name });  // Assuming your User model has fields for email and name
      await user.save();
      // Create a default profile for the user
      const defaultProfile = new Profile({
        userId: user._id,
        artistName: user.name || 'Unknown Artist'
      });
      await defaultProfile.save();
    }
    req.session.userId = user._id;
    res.status(200).json({ message: 'Login successful.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Failed to logout.' });
    }
    res.clearCookie('sid');  // Assuming the session cookie name is 'sid', adjust if different
    res.status(200).json({ message: 'Logged out successfully.' });
  });
};
