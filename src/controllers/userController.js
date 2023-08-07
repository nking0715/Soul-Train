const User = require('../models/user');
const bcrypt = require('bcryptjs');
const authService = require('../services/authService');
const { validationResult } = require('express-validator');

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

    // Generate a JWT token
    const token = authService.generateToken(user);
    // Return the token to the client
    res.status(200).json({ token });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
