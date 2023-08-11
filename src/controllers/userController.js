const User = require('../models/user');
const bcrypt = require('bcryptjs');
const authService = require('../services/authService');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
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
      console.log(payload);
      const userId = payload['sub'];

      req.session.userId = userId;

      // Use the `userId` (or other payload fields) to identify the user in your system.
      // Maybe fetch their profile from MongoDB, or create a new profile if it's their first time logging in.

      res.status(200).send({ status: 'success', user: payload });

  } catch (error) {
      res.status(400).send({ status: 'error', message: 'Token verification failed.' });
  }
};