const User = require('../models/user');
const Asset = require('../models/asset');
const { validationResult } = require('express-validator');
const isEmpty = require('../utils/isEmpty')
const { uploadFileToS3 } = require('../utils/aws');
const authService = require('../services/authService');
const { moderateImage } = require('../helper/moderation.helper')

const videoMimeToExt = {
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'video/x-matroska': '.mkv',
    // ... add other types as needed
};

const imageMimeToExt = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/tiff': '.tiff',
    // ... add other types as needed
};

exports.getProfile = async (req, res) => {
    try {
        let profile = await User.findOne({ _id: req.params.userId || req.user.id });
        if (isEmpty(profile)) return res.status(404).json({ message: 'Profile not found' });

        profile = profile.toObject();
        // Remove private fields if the requester isn't the profile owner
        if (req.user.id !== profile._id.toString()) {
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
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { username, artistName, bio, profilePicture, coverPicture, crew, homeLocation, email, phoneNumber, style } = req.body;

        const profile = await User.findOne({ _id: req.user.id });

        if (isEmpty(profile)) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        // Check if artistName is being changed and if it has been changed before
        if (artistName && artistName !== profile.artistName && profile.hasChangedArtistName) {
            return res.status(400).json({ success: false, message: 'You can only change your artist name once.' });
        }

        if (artistName && artistName !== profile.artistName) {
            profile.hasChangedArtistName = true;
            profile.artistName = artistName;
        }

        // Update the other fields
        profile.username = username || profile.username
        profile.bio = bio || profile.bio;
        profile.profilePicture = profilePicture || profile.profilePicture;
        profile.coverPicture = coverPicture || profile.coverPicture;
        profile.crew = crew || profile.crew;
        profile.homeLocation = homeLocation || profile.homeLocation;
        profile.email = email || profile.email;
        profile.phoneNumber = phoneNumber || profile.phoneNumber;
        profile.style = style || profile.style

        await profile.save();

        // Generate a JWT token
        const token = authService.generateToken(profile);

        return res.status(200).json({ success: true, message: "success", token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.uploadVideo = async (req, res) => {
    var videoLink = ''
    try {
        const files = req.files;
        const userId = req.user.id;
        const tags = req.tags;
        const description = req.description;
        const profile = await User.findOne({ _id: userId });

        if (isEmpty(profile)) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (req.files && Object.keys(req.files).length > 0) {
            let uploadVideo = req.files.video;
            let maxFileSizeBytes = 200000000; // At least 200MB
            // Get file extension
            const fileExtension = videoMimeToExt[uploadVideo.mimetype];

            // Check if the file type is supported
            if (!fileExtension) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }
            if (uploadVideo.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 200MB" });
            } else {
                for (const key of Object.keys(files)) {
                    const file = files[key];
                    const file_on_s3 = await uploadFileToS3(file, "videos");
                    videoLink = file_on_s3;
                    break;
                }
            }

            const newVideo = new Asset({
                userId: userId,
                url: videoLink,
                type: "video",
                tags: tags,
                description: description
            })
            await newVideo.save();
            return res.status(400).json({ success: true, message: "success" })
        } else {
            return res.status(400).json({ success: false, message: "Invalid Request!" })
        }
    } catch (err) {
        console.log("Upload Video Error ", err)
        return res.status(400).json({ success: false, message: err.message });
    }
}

exports.uploadPhoto = async (req, res) => {
    var imageLink = '';
    try {
        const files = req.files;
        const userId = req.user.id;
        const tags = req.tags;
        const description = req.description;
        const profile = await User.findOne({ _id: userId });

        if (isEmpty(profile)) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.files && Object.keys(req.files).length > 0) {
            let uploadImage = req.files.photo;
            let maxFileSizeBytes = 10000000; // At least 10MB
            // Get file extension
            const fileExtension = imageMimeToExt[uploadImage.mimetype];

            // Check if the file type is supported
            if (!fileExtension) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }
            if (uploadImage.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 10MB" });
            } else {
                for (const key of Object.keys(files)) {
                    const file = files[key];
                    const file_on_s3 = await uploadFileToS3(file, "photos");
                    imageLink = file_on_s3;
                    break;
                }
            }
            const newPhoto = new Asset({
                userId: userId,
                url: imageLink,
                type: "photo",
                tags: tags,
                description: description
            })
            await newPhoto.save();
            return res.status(400).json({ success: true, message: "success" })
        } else {
            return res.status(400).json({ success: false, message: "Invalid Request!" })
        }
    } catch (err) {
        console.log("upload Photo Error ", err)
        return res.status(400).json({ success: false, message: err.message });
    }
}

exports.uploadImage = async (req, res) => {
    var imageLink = '';
    const files = req.files;
    try {
        if (req.files && Object.keys(req.files).length > 0) {
            let uploadImage = req.files.image;
            let maxFileSizeBytes = 10000000; // At least 10MB
            const fileExtension = imageMimeToExt[uploadImage.mimetype];
            // Check if the file type is supported
            if (!fileExtension) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }
            
            if (uploadImage.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 10MB" });
            } else {
                for (const key of Object.keys(files)) {
                    const file = files[key];
                    // await moderateImage(file);
                    const file_on_s3 = await uploadFileToS3(file, "images");
                    imageLink = file_on_s3;
                    break;
                }
            }
        } else {
            return res.status(400).json({ success: false, message: "You didn't upload image" });
        }
        return res.status(200).json({ success: true, message: "success", imageLink });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}

exports.connectDancer = async (req, res) => {
    try {
        const { dancerId } = req.body;
        if (isEmpty(dancerId)) return res.status(400).json({ success: false, message: "Invalid Request!" });

        let userId = req.user.id;
        let dancer = await User.findOne({ _id: dancerId });
        let user = await User.findOne({ _id: userId })
        if (isEmpty(dancer)) return res.status(404).json({ success: false, message: 'Profile not found' });

        if (dancer.pending.includes(userId)) return res.status(400).json({ success: false, message: "You already sent the connect request, please wait until accept" });
        if (dancer.connect.includes(userId)) return res.status(400).json({ success: false, message: "You already connected with that user" });

        if (!user.following.includes(dancerId)) {
            user.following.push(dancerId)
            await user.save();
        }

        if (!dancer.follower.includes(userId)) {
            dancer.follower.push(userId)
        }
        dancer.pending.push(userId);

        await dancer.save();

        return res.status(200).json({ success: true, message: "Successfully sent the connect request" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.acceptDancer = async (req, res) => {
    try {
        const { dancerId } = req.body;

        if (isEmpty(dancerId)) return res.status(400).json({ success: false, message: "Invalid Request!" });

        let userId = req.user.id;

        let dancer = await User.findOne({ _id: dancerId });
        let user = await User.findOne({ _id: userId })

        if (isEmpty(dancer)) return res.status(404).json({ success: false, message: 'Connect Requester not found' });
        if (!user.pending.includes(dancerId)) return res.status(400).json({ success: false, message: "Invalid Request!" });

        if (!user.following.includes(dancerId)) {
            user.following.push(dancerId)
        }

        if (!dancer.follower.includes(userId)) {
            dancer.follower.push(userId)
        }

        const index = user.pending.indexOf(dancerId);
        user.pending.splice(index, 1);

        user.connect.push(dancerId);
        dancer.connect.push(userId)

        await user.save();
        await dancer.save();

        return res.status(200).json({ success: true, message: "Successfully connected" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.followManage = async (req, res) => {
    try {
        const { dancerId } = req.body;

        if (isEmpty(dancerId)) return res.status(400).json({ success: false, message: "Invalid Request!" });

        let userId = req.user.id;

        let dancer = await User.findOne({ _id: dancerId });
        let user = await User.findOne({ _id: userId })

        if (isEmpty(dancer) || isEmpty(user)) return res.status(404).json({ success: false, message: 'User Not found' });

        if (user.following.includes(dancerId)) {
            const userIndex = user.following.indexOf(dancerId);
            user.following.splice(userIndex, 1);

            const dancerIndex = dancer.follower.indexOf(userId)
            dancer.follower.splice(dancerIndex, 1);
        } else {
            user.following.push(dancerId)
            dancer.follower.push(userId)
        }

        await user.save();
        await dancer.save();

        return res.status(200).json({ success: true, message: "success" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
