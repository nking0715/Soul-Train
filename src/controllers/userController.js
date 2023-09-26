const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const sendMail = require('./sendMail/gmail');
require('events').EventEmitter.prototype._maxListeners = 0;
const jwt_decode = require("jwt-decode");
const User = require('../models/user');
const Waitlist = require('../models/waitlist')
const authService = require('../services/authService');
const isEmpty = require('../utils/isEmpty');
const { isValidEmail } = require('../helper/validateEmail.helper');
const nodeFbLogin = require('node-fb-login');

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

      return res.status(200).json({ success: true, message: 'Validation code successfully sent to the user' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      return res.status(400).json({ success: false, message: 'Your email has already verified' });
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
    if (!user) return res.status(400).json({ message: "User doesn't exist!" });

    const validPassword = await bcrypt.compare(req.body.password, user.password ? user.password : "");
    if (!validPassword) return res.status(400).json({ message: "Wrong password" });
    if (!user.emailVerified) return res.status(400).json({ message: 'Please verify your email' });
    req.session.userId = user._id;

    // Generate a JWT token
    const token = authService.generateToken(user);
    // Return the token to the client
    res.status(200).json({ token });

  } catch (error) {
    console.log("Login Error ", error);
    res.status(500).json({ message: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  const idToken = req.body.idToken;

  try {
    const decodedToken = jwt_decode(idToken);
    const email = decodedToken.email;
    const name = decodedToken.name;
    if (isEmpty(email) || isEmpty(name)) {
      return res.status(400).json({ success: false, message: "Invalid Token" })
    }
    let user = await User.findOne({ email: email });
    if (isEmpty(user)) {
      user = new User({ email: email, username: name, artistName: name, emailVerified: true });  // Assuming your User model has fields for email and name
      await user.save();

      req.session.userId = user._id;

      // Generate a JWT token
      const token = authService.generateToken(user);

      return res.status(201).json({ success: true, username: user.username, artistName: name, email: user.email, id: user._id, token });
    } else {
      req.session.userId = user._id;

      // Generate a JWT token
      const token = authService.generateToken(user);
      // Return the token to the client
      return res.status(200).json({ token });
    }
  } catch (error) {
    res.status(400).send({ status: 'error', success: false, message: 'Token verification failed.' });
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
    return res.status(400).json({ success: false, message: 'Facebook access token is required.' });
  }
  try {
    const data = await nodeFbLogin.getUserProfile({
      accessToken: accessToken,
      fields: ["id", "name", "email"]
    });

    if (!data) {
      return res.status(404).json({ success: false, message: 'Failed to fetch user details from Facebook.' });
    }

    console.log("data ", data)
    const name = data.name;
    const email = data.email;

    if (isEmpty(email) || isEmpty(name)) {
      return res.status(400).json({ success: false, message: "Invalid Token" })
    }
    let user = await User.findOne({ email: email });
    if (isEmpty(user)) {
      user = new User({ email: email, username: name, artistName: name, emailVerified: true });  // Assuming your User model has fields for email and name
      await user.save();

      req.session.userId = user._id;

      // Generate a JWT token
      const token = authService.generateToken(user);

      return res.status(201).json({ success: true, username: name, artistName: name, email: user.email, id: user._id, token });
    } else {
      req.session.userId = user._id;

      // Generate a JWT token
      const token = authService.generateToken(user);
      // Return the token to the client
      return res.status(200).json({ success: true, token });
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
  const { page, per_page } = req.body;
  if (isEmpty(page) || isEmpty(per_page)) {
    return res.status(400).json({ success: false, message: "Invalid Request!" });
  }
  const start = (page - 1) * per_page; // Calculate the skip value

  const { searchText } = req.params;
  const userId = req.user.id; // Assumed to be set somewhere in your code

  if (isEmpty(searchText)) {
    return res.status(400).json({ success: false, message: "Invalid Request" });
  }

  try {
    const users = await User.find({
      _id: { $ne: userId },
      $or: [
        { username: { $regex: searchText, $options: "i" } },
        { artistName: { $regex: searchText, $options: "i" } },
        { bio: { $regex: searchText, $options: "i" } },
      ]
    })
      .select("profilePicture username artistName follower") // Also fetch the followers field
      .skip(start)  // Skip the documents
      .limit(per_page);  // Limit the number of documents

    const totalCount = await User.countDocuments({
      _id: { $ne: userId },
      $or: [
        { username: { $regex: searchText, $options: "i" } },
        { artistName: { $regex: searchText, $options: "i" } },
        { bio: { $regex: searchText, $options: "i" } },
      ]
    });

    // Add a "followed" boolean to each user based on whether the current user follows them
    const usersWithFollowStatus = users.map(user => {
      const followed = user.follower.includes(userId);
      return {
        ...user._doc, // Spread the existing user fields
        followed, // Add the "followed" status
      };
    });

    return res.status(200).json({
      success: true, users: usersWithFollowStatus,
      meta: {
        total: totalCount,
        page,
        per_page,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

exports.resetReq = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email });
    if (isEmpty(user)) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (isEmpty(user.email)) {
      return res.status(400).json({ success: false, message: "You didn't register with email and password" });
    }

    const resetToken = Math.floor(1000 + Math.random() * 9000).toString();
    user.resetToken = resetToken;
    user.resetPassExpiry = Date.now() + 24 * 60 * 60 * 1000;  // 24 hours from now

    const options = {
      to: user.email,
      from: 'noreply@soultrain.app',
      subject: 'Reset Password Code',
      text: `Your reset password code is: ${resetToken}`,
    };

    const messageId = await sendMail(options);
    console.log('Message sent successfully:', messageId);

    await user.save();
    req.session.userId = user._id;
    return res.status(200).json({ success: true, message: 'Reset token successfully sent to your email, please check' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

exports.verifyResetCode = async (req, res) => {
  try {
    const { resetToken } = req.body;
    const user = await User.findOne({ _id: req.session.userId });
    if (isEmpty(user)) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.resetToken != resetToken || user.resetPassExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset password token' });
    }
    
    user.resetCodeValidated = true;
    // Return the token to the client
    return res.status(200).json({ success: true, message: "valid token" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findOne({ _id: req.session.userId });
    if (isEmpty(user)) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.resetCodeValidated != true ) {
      return res.status(400).json({ success: false, message: 'Code is not validated' });
    }
    user.password = password;
    user.resetCodeValidated = false;
    await user.save();
    // Generate a JWT token
    const token = authService.generateToken(user);
    // Return the token to the client
    return res.status(200).json({ token });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.addToWaitList = async (req, res) => {
  const { username, email } = req.body;
  if (isEmpty(username) || isEmpty(email)) {
    return res.status(400).json({ success: false, message: "Invalid Request!" })
  }

  const validateEmail = await isValidEmail(email)
  if (validateEmail) {
    let user = await User.findOne({ email: email });
    if (isEmpty(user)) {
      let waitUser = await Waitlist.findOne({ email: email });
      if (isEmpty(waitUser)) {
        waitUser = new Waitlist(req.body);
        await waitUser.save();
      }
      return res.status(200).json({ success: true, message: 'Successfully submitted!' });
    } else {
      return res.status(200).json({ success: true, message: 'Successfully submitted!' });
    }
  } else {
    return res.status(400).json({ success: false, message: "Invalid Email type!" })
  }
}
