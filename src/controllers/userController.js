const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const sendMail = require('./sendMail/gmail');
require('events').EventEmitter.prototype._maxListeners = 0;
const jwt_decode = require("jwt-decode");
const User = require('../models/user');
const authService = require('../services/authService');
const isEmpty = require('../utils/isEmpty');
require('dotenv').config();

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

      const validationCode = Math.floor(1000 + Math.random() * 9000).toString();
      user.validationCode = validationCode;
      user.codeExpiry = Date.now() + 24 * 60 * 60 * 1000;  // 24 hours from now

      const options = {
        to: user.email,
        from: 'noreply@soultrain.app',
        subject: 'Validation Code',
        text: `Your validation code is: ${validationCode}`,
      };

      const messageId = await sendMail(options);
      console.log('Message sent successfully:', messageId);

      await user.save();
      req.session.userId = user._id;

      return res.status(200).json({ message: 'Validation code successfully sent to the user' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.verifyValidationCode = async (req, res) => {
  try {
    const { validationCode, email } = req.body;
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.validationCode != validationCode || user.codeExpiry < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired validation code' });
    }

    user.emailVerified = true;
    await user.save();
    // Generate a JWT token
    const token = authService.generateToken(user);
    // Return the token to the client
    return res.status(200).json({ token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email });
    if (isEmpty(user)) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(404).json({ success: false, message: 'Your email has already verified' });
    }

    const validationCode = Math.floor(1000 + Math.random() * 9000).toString();
    user.validationCode = validationCode;
    user.codeExpiry = Date.now() + 24 * 60 * 60 * 1000;  // 24 hours from now

    const options = {
      to: user.email,
      from: 'noreply@soultrain.app',
      subject: 'Validation Code',
      text: `Your validation code is: ${validationCode}`,
    };

    const messageId = await sendMail(options);
    console.log('Message sent successfully:', messageId);

    await user.save();
    req.session.userId = user._id;
    return res.status(200).json({ success: true, message: 'Validation code successfully sent to the user' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

exports.login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password.' });

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ message: 'Invalid email or password.' });
    if (!user.emailVerified) return res.status(400).json({ message: 'Please verify your email' });
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
    const decodedToken = jwt_decode(idToken);
    const email = decodedToken.email;
    const name = decodedToken.name;
    let user = await User.findOne({ email: email });
    if (!user) {
      user = new User({ email: email, username: name, emailVerified: true });  // Assuming your User model has fields for email and name
      await user.save();

      res.status(201).json({ username: user.username, email: user.email, id: user._id });
    } else {
      req.session.userId = user._id;

      // Generate a JWT token
      const token = authService.generateToken(user);
      // Return the token to the client
      res.status(200).json({ token });
    }
  } catch (error) {
    res.status(400).send({ status: 'error', message: 'Token verification failed.' });
  }
};

exports.addArtistName = async (req, res) => {
  const artistName = req.body.artistName;
  try {
    let user = await User.findOne({ _id: req.params.userId });
    if (isEmpty(user)) {
      return res.status(400).json({ success: false, message: "User not found" })
    }
    user.artistName = artistName;
    await user.save();

    req.session.userId = user._id;

    // Generate a JWT token
    const token = authService.generateToken(user);
    // Return the token to the client
    return res.status(200).json({ token });
  } catch (err) { res.status(400).send({ status: 'error', message: err.message }) }
};

exports.facebookLogin = async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    return res.status(400).json({ message: 'Facebook access token is required.' });
  }
  try {
    const { data } = await axios({
      url: 'https://graph.facebook.com/me',
      method: 'get',
      params: {
        fields: ['id', 'first_name', 'last_name'].join(','),
        access_token: accessToken,
      },
    });

    if (!data) {
      return res.status(404).json({ message: 'Failed to fetch user details from Facebook.' });
    }

    const facebookId = data.id;
    const name = data.first_name + " " + data.last_name;

    let user = await User.findOne({ facebookID: facebookId });
    if (!user) {
      user = new User({ facebookID: facebookId, username: name, emailVerified: true });  // Assuming your User model has fields for email and name
      await user.save();

      return res.status(201).json({ username: user.username, id: user._id });
    } else {
      req.session.userId = user._id;

      // Generate a JWT token
      const token = authService.generateToken(user);
      // Return the token to the client
      return res.status(200).json({ token });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
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

exports.searchDancers = async (req, res) => {
  const { user } = req.body;
  if (isEmpty(user)) {
    return res.status(400).json({ success: false, message: "Invalid Request" });
  }
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: user, $options: "i" } }, // Case-insensitive search
        { artistName: { $regex: user, $options: "i" } } // Case-insensitive search
      ]
    }).select("username artistName"); // Select only the desired fields

    return res.status(200).json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
