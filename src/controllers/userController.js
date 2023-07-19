const User = require('../models/user');

// Get the current user's profile
exports.getCurrentUser = async (req, res) => {
  try {
    // Find the user by ID
    const user = await User.findById(req.user.id);

    // Return the user's profile to the client
    res.json({ user });
  } catch (err) {
    console.error('Failed to get user profile', err);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
};

// Update the current user's profile
exports.updateCurrentUser = async (req, res) => {
  try {
    // Find the user by ID and update the profile
    const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true });

    // Return the updated user's profile to the client
    res.json({ user });
  } catch (err) {
    console.error('Failed to update user profile', err);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
};