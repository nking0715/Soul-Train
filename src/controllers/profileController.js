const User = require('../models/user');
const Asset = require('../models/asset');
const { validationResult } = require('express-validator');
const isEmpty = require('../utils/isEmpty')
const { uploadFileToS3 } = require('../utils/aws');
const authService = require('../services/authService');
const { moderateContent } = require('../helper/moderation.helper')
const dateFormat = require('date-and-time');
const path = require('path');

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
        return res.status(200).json(profile);
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { username, artistName, bio, profilePicture, coverPicture, crew, email, phoneNumber, style } = req.body;

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

exports.uploadContents = async (req, res) => {
    let contentLink, contentType, contentMimeToExt, maxFileSizeBytes, bucketPath, rekognitionResult = '';
    try {
        const files = req.files;
        const userId = req.user.id;
        const { tags, description, type, purpose } = req.body;
        const user = await User.findOne({ _id: userId });
        const per_page = 50;

        if (isEmpty(user)) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (type == "image") {
            contentType = "image";
            contentMimeToExt = { ...imageMimeToExt };
            maxFileSizeBytes = 10000000;
            bucketPath = "images";
        } else if (type == "video") {
            contentType = "video";
            contentMimeToExt = { ...videoMimeToExt };
            maxFileSizeBytes = 200000000;
            bucketPath = "videos";
        }

        if (files && Object.keys(files).length > 0) {
            let uploadedContents = files.files;
            // Get file extension
            const fileExtension = contentMimeToExt[uploadedContents.mimetype];

            let extdotname = path.extname(uploadedContents.name);
            var ext = extdotname.slice(1);
            let name = dateFormat.format(new Date(), "YYYYMMDDHHmmss") + "." + ext;
            // Check if the file type is supported
            if (!fileExtension) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }
            if (uploadedContents.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 10MB" });
            } else {
                const file_on_s3 = await uploadFileToS3(name, uploadedContents, bucketPath);
                contentLink = file_on_s3;
                rekognitionResult = await moderateContent(`${bucketPath}/${name}`, contentType);
                console.log("content rekognitionResult ", rekognitionResult)
            }
            const newAsset = new Asset({
                userId: userId,
                url: contentLink,
                purpose: purpose,
                type: type,
                tags: tags,
                description: description,
                blocked: rekognitionResult.success ? false : true
            })
            await newAsset.save();

            if (rekognitionResult.success == false) {
                return res.status(400).json({ success: false, message: "The uploaded image or video contains inappropriate content" });
            }

            if (purpose == 'profilePicture') {
                user.profilePicture = newAsset.url;
                await user.save();
                return res.status(200).json({ success: true, user });
            }

            if (purpose == 'coverPicture') {
                user.coverPicture = newAsset.url;
                await user.save();
                return res.status(200).json({ success: true, user });
            }

            switch (purpose) {
                case "uploadedImage":
                    user.uploadedImage.push(newAsset.url);
                    if (user.uploadedImage.length > per_page) {
                        user.uploadedImage.pop();  // Remove the last element if there are more than 50 elements
                    }
                    break;
                case "uploadedVideo":
                    user.uploadedVideo.push(newAsset.url);
                    if (user.uploadedVideo.length > per_page) {
                        user.uploadedVideo.pop();  // Remove the last element if there are more than 50 elements
                    }
            }

            return res.status(200).json({ success: true, user });
        } else {
            return res.status(400).json({ success: false, message: "Invalid Request!" })
        }
    } catch (err) {
        console.log("upload content Error ", err)
        return res.status(400).json({ success: false, message: err.message });
    }
}

exports.getUploadedContents = async (req, res) => {
    const { page, type } = req.body;
    const per_page = 50;
    if (isEmpty(page) || isEmpty(type)) {
        return res.status(400).json({ success: false, message: "Invalid Request!" });
    }
    const skip = (page - 1) * per_page; // Calculate the skip value

    let typeFilter = {};
    if (type !== 'all') {
        typeFilter.type = type;
    }

    try {
        const assets = await Asset.find({
            userId: req.params.userId || req.user.id,
            ...typeFilter,
            purpose: { $in: ['uploadedImage', 'uploadedVideo'] }
        })
            .sort({ uploadedTime: -1 }) // Sort by updated time, descending
            .limit(per_page)
            .skip(skip)
            .select('url');
        const urls = assets.map(asset => asset.url);
        return res.status(200).json({ success: true, urls: urls });
    } catch (error) {
        console.error("Error fetching assets:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

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
