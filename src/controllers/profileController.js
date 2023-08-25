const Profile = require('../models/profile');
const Video = require('../models/video');
const { validationResult } = require('express-validator');

const AWS = require('aws-sdk');
const fs = require('fs');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'eu-north-1' // your desired region
});

const mimeToExt = {
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'video/x-matroska': '.mkv',
    // ... add other types as needed
};


const s3 = new AWS.S3();

exports.getProfile = async (req, res) => {
    try {
        let profile = await Profile.findOne({ userId: req.params.userId || req.user.id });
        if (!profile) return res.status(404).json({ message: 'Profile not found' });

        profile = profile.toObject();
        // Remove private fields if the requester isn't the profile owner
        if (req.userId !== profile.userId.toString()) {
            delete profile.email;
            delete profile.phoneNumber;
        }

        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { artistName, bio, profilePicture, coverPicture, crew, homeLocation, email, phoneNumber } = req.body;

        const profile = await Profile.findOne({ userId: req.user.id });

        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        // Check if artistName is being changed and if it has been changed before
        if (artistName && artistName !== profile.artistName && profile.hasChangedArtistName) {
            return res.status(400).json({ message: 'You can only change your artist name once.' });
        }

        if (artistName && artistName !== profile.artistName) {
            profile.hasChangedArtistName = true;
            profile.artistName = artistName;
        }

        // Update the other fields
        profile.bio = bio || profile.bio;
        profile.profilePicture = profilePicture || profile.profilePicture;
        profile.coverPicture = coverPicture || profile.coverPicture;
        profile.crew = crew || profile.crew;
        profile.homeLocation = homeLocation || profile.homeLocation;
        profile.email = email || profile.email;
        profile.phoneNumber = phoneNumber || profile.phoneNumber;

        await profile.save();

        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.uploadVideo = async (req, res) => {
    const startTime = Date.now();
    try {        
        const file = req.file;
        const userId = req.user.id;
        const profile = await Profile.findOne({ userId: userId });
        const tags = req.tags;
        const description = req.description;

        // Get file extension
        const fileExtension = mimeToExt[file.mimetype];

        // Generate a unique filename with the correct extension
        const uniqueFileName = `${userId}-${Date.now()}${fileExtension}`;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: uniqueFileName,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype,
            ACL: 'public-read'
        };
        try {
            s3.upload(params, async (err, data) => {                
                if (err) {
                    fs.unlink(file.path, (unlinkErr) => {
                        if (unlinkErr) console.error(unlinkErr);
                    });
                    return res.status(500).json({ error: true, Message: err });
                }
                const s3FileURL = data.Location;
                res.status(200).json({ videoUrl: s3FileURL });
                fs.unlink(file.path, (unlinkErr) => {
                    if (unlinkErr) console.error(unlinkErr);
                });
                const newVideo = new Video({
                    profile: profile,
                    url: s3FileURL,
                    tags: tags,
                    description: description
                })
                await newVideo.save();
                profile.videos.push(newVideo._id);
                await profile.save();
                // Record the end time and calculate the difference
                const endTime = Date.now();
                const uploadTime = endTime - startTime;
                console.log(`Upload successful! It took ${uploadTime} milliseconds.`);
            });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    } catch (err) {
        res.status(400).json({ message: err.message });
    }

}
