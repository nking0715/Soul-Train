const Profile = require('../models/Profile');
const { validationResult } = require('express-validator');

exports.getProfile = async (req, res) => {
    try {
        const profile = await Profile.findOne({ userId: req.userId }); // Assuming you have user's id from a middleware
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    // Handle errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // If validations pass, continue with the update logic
    try {
        const { bio, dateOfBirth, profilePicture, location, website } = req.body;

        // Here, we assume that req.userId contains the ID of the currently logged-in user
        // This would typically be set in a middleware after verifying the user's token
        const profile = await Profile.findOneAndUpdate(
            { userId: req.userId },
            { bio, dateOfBirth, profilePicture, location, website },
            { new: true, upsert: true }
        );

        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ... Any other required methods (deleteProfile, createProfile, etc.)
