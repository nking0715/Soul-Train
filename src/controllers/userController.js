const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const sendMail = require('./sendMail/gmail');
require('events').EventEmitter.prototype._maxListeners = 0;
const jwt_decode = require("jwt-decode");
const User = require('../models/user');
const Admin = require('../models/admin');
const Waitlist = require('../models/waitlist')
const authService = require('../services/authService');
const isEmpty = require('../utils/isEmpty');
const { isValidEmail } = require('../helper/validateEmail.helper');
const nodeFbLogin = require('node-fb-login');
const FcmToken = require('../models/fcmToken');

require('dotenv').config();

exports.register = async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    } else {
      user = new User(req.body);

      const validationCode = Math.floor(1000 + Math.random() * 9000).toString();
      user.validationCode = validationCode;
      user.codeExpiry = Date.now() + 24 * 60 * 60 * 1000;  // 24 hours from now

      const options = {
        to: user.email,
        from: 'no-reply@soultrain.app',
        subject: 'Validation Code',
        text: `Your validation code is: ${validationCode}`,
      };

      await sendMail(options);

      await user.save();
      req.session.userId = user._id;

      return res.status(200).json({ success: true, message: 'Validation code successfully sent to the user' });
    }
  } catch (error) {
    console.log('Error in register: ', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.verifyValidationCode = async (req, res) => {
  try {
    const { validationCode, email, fcmToken, deviceInfo } = req.body;
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.validationCode != validationCode || user.codeExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired validation code' });
    }

    user.emailVerified = true;
    // Generate a JWT token
    const token = authService.generateToken(user);

    const userId = user._id;
    if (isEmpty(fcmToken) || isEmpty(deviceInfo)) {
      return res.status(400).json({ success: false, message: 'FcmToken or DeviceInfo is invalid.' });
    }
    const existingToken = await FcmToken.findOne({ token: fcmToken });
    if (!existingToken) {
      const checkUserToken = await FcmToken.findOne({ userId: userId });
      if (checkUserToken) {
        checkUserToken.token = fcmToken;
        await checkUserToken.save();
      } else {
        // Since the token doesn't exist, save the new one
        const newToken = new FcmToken({ userId, token: fcmToken, deviceInfo });
        await newToken.save();
      }
    } else if (userId != existingToken.userId) {
      existingToken.userId = userId;
      await existingToken.save();
    }
    await user.save();
    // Return the token to the client
    return res.status(200).json({ success: true, token });
  } catch (error) {
    console.log('Error in register: ', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
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
      from: 'no-reply@soultrain.app',
      subject: 'Validation Code',
      text: `Your validation code is: ${validationCode}`,
    };

    await sendMail(options);

    await user.save();
    req.session.userId = user._id;
    return res.status(200).json({ success: true, message: 'Validation code successfully sent to the user' });
  } catch (error) {
    console.log('Error in resendVerificationCode: ', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password, fcmToken, deviceInfo } = req.body;
    const user = await User.findOne({ email: email });
    if (!user) return res.status(400).json({ success: false, message: "User doesn't exist!" });

    const validPassword = await bcrypt.compare(password, user.password ? user.password : "");
    if (!validPassword) return res.status(400).json({ success: false, message: "Wrong password" });
    if (!user.emailVerified) return res.status(400).json({ success: false, message: 'Please verify your email' });
    req.session.userId = user._id;

    // Generate a JWT token
    const token = authService.generateToken(user);

    const userId = user._id;
    if (isEmpty(fcmToken) || isEmpty(deviceInfo)) {
      return res.status(400).json({ success: false, message: 'FcmToken or DeviceInfo is invalid.' });
    }
    const existingToken = await FcmToken.findOne({ token: fcmToken });
    if (!existingToken) {
      const checkUserToken = await FcmToken.findOne({ userId: userId });
      if (checkUserToken) {
        checkUserToken.token = fcmToken;
        await checkUserToken.save();
      } else {
        // Since the token doesn't exist, save the new one
        const newToken = new FcmToken({ userId, token: fcmToken, deviceInfo });
        await newToken.save();
      }
    } else if (userId != existingToken.userId) {
      existingToken.userId = userId;
      await existingToken.save();
    }

    // Return the token to the client
    return res.status(200).json({ success: true, token });

  } catch (error) {
    console.log("Error in login: ", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { idToken, fcmToken, deviceInfo } = req.body;
    const decodedToken = jwt_decode(idToken);
    const email = decodedToken.email;
    const name = decodedToken.name;
    if (isEmpty(email) || isEmpty(name)) {
      return res.status(400).json({ success: false, message: "Invalid Token" })
    }
    let user = await User.findOne({ email: email });
    if (isEmpty(user)) {
      user = new User({ email: email, username: name, emailVerified: true });
      await user.save();

      req.session.userId = user._id;

      return res.status(201).json({ success: true, username: user.username, email: user.email, id: user._id });
    } else if (isEmpty(user.artistName)) {
      req.session.userId = user._id;
      return res.status(201).json({ success: true, username: user.username, email: user.email, id: user._id });
    } else {
      // Generate a JWT token
      const token = authService.generateToken(user);

      const userId = user._id;
      if (isEmpty(fcmToken) || isEmpty(deviceInfo)) {
        return res.status(400).json({ success: false, message: 'FcmToken or DeviceInfo is invalid.' });
      }
      const existingToken = await FcmToken.findOne({ token: fcmToken });
      if (!existingToken) {
        const checkUserToken = await FcmToken.findOne({ userId: userId });
        if (checkUserToken) {
          checkUserToken.token = fcmToken;
          await checkUserToken.save();
        } else {
          // Since the token doesn't exist, save the new one
          const newToken = new FcmToken({ userId, token: fcmToken, deviceInfo });
          await newToken.save();
        }
      } else if (userId != existingToken.userId) {
        existingToken.userId = userId;
        await existingToken.save();
      }

      // Return the token to the client
      return res.status(200).json({ success: true, token });
    }
  } catch (error) {
    console.log("Error in googleLogin: ", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.addArtistName = async (req, res) => {
  try {
    const { artistName, fcmToken, deviceInfo } = req.body;
    let user = await User.findOne({ _id: req.session.userId });
    if (isEmpty(user)) {
      return res.status(400).json({ success: false, message: "User not found" })
    }
    if (!isEmpty(user.artistName)) {
      return res.status(400).json({ success: false, message: "This user already has an artist name." });
    }
    user.artistName = artistName;
    // Generate a JWT token
    const token = authService.generateToken(user);

    const userId = user._id;
    if (isEmpty(fcmToken) || isEmpty(deviceInfo)) {
      return res.status(400).json({ success: false, message: 'FcmToken or DeviceInfo is invalid.' });
    }
    const existingToken = await FcmToken.findOne({ token: fcmToken });
    if (!existingToken) {
      const checkUserToken = await FcmToken.findOne({ userId: userId });
      if (checkUserToken) {
        checkUserToken.token = fcmToken;
        await checkUserToken.save();
      } else {
        // Since the token doesn't exist, save the new one
        const newToken = new FcmToken({ userId, token: fcmToken, deviceInfo });
        await newToken.save();
      }
    } else if (userId != existingToken.userId) {
      existingToken.userId = userId;
      await existingToken.save();
    }

    await user.save();
    // Return the token to the client
    return res.status(200).json({ success: true, token });
  } catch (error) {
    console.log("Error in addArtistName: ", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.facebookLogin = async (req, res) => {
  try {
    const { accessToken, fcmToken, deviceInfo } = req.body;
    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'Facebook access token is required.' });
    }
    const data = await nodeFbLogin.getUserProfile({
      accessToken: accessToken,
      fields: ["id", "name", "email"]
    });

    if (!data) {
      return res.status(400).json({ success: false, message: 'Failed to fetch user details from Facebook.' });
    }

    const name = data.name;
    const email = data.email;

    if (isEmpty(email) || isEmpty(name)) {
      return res.status(400).json({ success: false, message: "Invalid Token" })
    }
    let user = await User.findOne({ email: email });
    if (isEmpty(user)) {
      user = new User({ email: email, username: name, emailVerified: true });
      await user.save();

      req.session.userId = user._id;

      return res.status(201).json({ success: true, username: name, email: user.email, id: user._id });
    } else if (isEmpty(user.artistName)) {
      req.session.userId = user._id;
      return res.status(201).json({ success: true, username: name, email: user.email, id: user._id });
    } else {
      // Generate a JWT token
      const token = authService.generateToken(user);

      const userId = user._id;
      if (isEmpty(fcmToken) || isEmpty(deviceInfo)) {
        return res.status(400).json({ success: false, message: 'FcmToken or DeviceInfo is invalid.' });
      }
      const existingToken = await FcmToken.findOne({ token: fcmToken });
      if (!existingToken) {
        const checkUserToken = await FcmToken.findOne({ userId: userId });
        if (checkUserToken) {
          checkUserToken.token = fcmToken;
          await checkUserToken.save();
        } else {
          // Since the token doesn't exist, save the new one
          const newToken = new FcmToken({ userId, token: fcmToken, deviceInfo });
          await newToken.save();
        }
      } else if (userId != existingToken.userId) {
        existingToken.userId = userId;
        await existingToken.save();
      }

      // Return the token to the client
      return res.status(200).json({ success: true, token });
    }
  } catch (error) {
    console.log("Error in addArtistName: ", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.logout = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.session.userId;
    await FcmToken.findOneAndDelete({ userId, token: fcmToken });
    req.session.destroy();
    res.clearCookie('sid');  // Assuming the session cookie name is 'sid', adjust if different
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    console.log('Error in logout: ', error.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

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
    user.save();
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
    if (user.resetCodeValidated != true) {
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

exports.addAdmin = async (req, res) => {
  try {
    let admin = await Admin.findOne({ email: req.body.email });
    if (admin) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    } else {
      admin = new Admin(req.body);

      await admin.save();

      return res.status(200).json({ success: true, message: 'Successfully registered.' });
    }
  } catch (error) {
    console.log('Error in register: ', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}