const Video = require('../models/video');
const Photo = require('../models/photo');
const { validationResult } = require('express-validator');

exports.discoverContents = async (req, res) => {
    try {
        let profile = await Profile.findOne({ userId: req.params.userId || req.user.id });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });

        profile = profile.toObject();
        // Remove private fields if the requester isn't the profile owner
        if (req.user.id !== profile.userId.toString()) {
            delete profile.email;
            delete profile.phoneNumber;
        }

        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
