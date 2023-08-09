const Profile = require('../models/profile');
const { validationResult } = require('express-validator');

exports.getProfile = async (req, res) => {
    try {
        const profile = await Profile.findOne({ userId: req.userId }); // Assuming you have user's id from a middleware
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        res.status(200).json(profile);
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
        const { aboutMe, dateOfBirth, profilePicture, country, city } = req.body;

        // Here, we assume that req.userId contains the ID of the currently logged-in user
        // This would typically be set in a middleware after verifying the user's token
        const profile = await Profile.findOneAndUpdate(
            { userId: req.userId },
            { aboutMe, dateOfBirth, profilePicture, country, city },
            { new: true, upsert: true }
        );

        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.followUser = async (req, res) => {
    try {
        // The id of the user to follow is passed as a parameter
        const userToFollowId = req.params.id;

        // We'll assume req.userId is the id of the user doing the following
        const followerId = req.userId;

        if (userToFollowId === followerId) {
            return res.status(400).json({ message: "You can't follow yourself." });
        }

        // Get the profiles of the follower and the user to be followed
        const followerProfile = await Profile.findOne({ userId: followerId });
        const userToFollowProfile = await Profile.findOne({ userId: userToFollowId });

        if (!followerProfile || !userToFollowProfile) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        // Check if the user is already following the other user
        if (followerProfile.following.includes(userToFollowId)) {
            return res.status(400).json({ message: 'You are already following this user' });
        }

        // Add the follower to the followed user's followers list
        userToFollowProfile.followers.push(followerId);
        await userToFollowProfile.save();

        // Add the followed user to the follower's following list
        followerProfile.following.push(userToFollowId);
        await followerProfile.save();

        res.json({ message: 'User followed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// ... Any other required methods (deleteProfile, createProfile, etc.)
