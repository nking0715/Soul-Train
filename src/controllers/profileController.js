const User = require('../models/user');
const Asset = require('../models/asset');
const { validationResult } = require('express-validator');
const isEmpty = require('../utils/isEmpty')
const { uploadFileToS3 } = require('../utils/aws');
const authService = require('../services/authService');
const { moderateContent } = require('../helper/moderation.helper')

const videoMimeToExt = {
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/x-msvideo': '.avi',
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
        let profile = await User.findOne({ _id: req.query.userId || req.user.id })
            .select('username artistName bio style  profilePicture coverPicture numberOfFollowers numberOfFollowings hasChangedArtistName emailVerified email phoneNumber');
        if (isEmpty(profile)) return res.status(400).json({ success: false, message: 'Profile not found' });

        profile = profile.toObject();
        // Remove private fields if the requester isn't the profile owner
        if (req.user.id !== profile._id.toString()) {
            delete profile.email;
            delete profile.phoneNumber;
            const user = await User.findOne({ _id: req.query.userId })
                .select('follower')
            const follower = user.follower;
            console.log(follower);
            if (!isEmpty(follower) && follower.includes(req.user.id)) {
                profile.isFollowed = true;
            } else {
                profile.isFollowed = false;
            }
        }
        return res.status(200).json({ success: true, profile });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getFollowerList = async (req, res) => {
    try {
        const { page, userId, per_page } = req.query;
        if (isEmpty(page) || isEmpty(per_page)) {
            return res.status(400).json({ success: false, message: "Invalid Request!" });
        }
        const skip = (page - 1) * per_page; // Calculate the skip value
        const user = await User.findOne({ _id: userId || req.user.id })
            .select('follower following');
        const followersList = await User.find({ _id: { $in: user.follower } })
            .limit(per_page)
            .skip(skip)
            .select('username artistName profilePicture');
        const followers = followersList.map(follower => {
            const isFollowingBack = user.following.some(followingId => followingId.toString() === follower._id.toString());
            return { ...follower.toObject(), isFollowingBack }; // Add the new key here
        });
        return res.status(200).json({ success: true, followers });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getFollowingList = async (req, res) => {
    try {
        const { page, userId, per_page } = req.query;
        if (isEmpty(page) || isEmpty(per_page)) {
            return res.status(400).json({ success: false, message: "Invalid Request!" });
        }
        const skip = (page - 1) * per_page; // Calculate the skip value
        const userToSearch = userId || req.user.id;
        const user = await User.findById(userToSearch)
            .select('following follower');
        const followingsList = await User.find({ _id: { $in: user.following } })
            .limit(per_page)
            .skip(skip)
            .select('username artistName profilePicture');
        const followings = followingsList.map(following => {
            const isFollowedBack = user.follower.some(followerId => followerId.toString() === following._id.toString());
            return { ...following.toObject(), isFollowedBack }; // Add the new key here
        });
        return res.status(200).json({ success: true, followings });
    } catch (error) {
        console.log(error.message);
        console.log("ddd");
        return res.status(500).json({ success: false, message: error.message });
    }
}

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

exports.uploadProfilePicture = async (req, res) => {
    try {
        const files = req.files;
        const userId = req.user.id;
        const user = await User.findOne({ _id: userId });
        const bucketPath = 'ProfilePicture';
        const maxFileSizeBytes = 10000000;
        const contentType = "image";
        let contentLink, rekognitionResult = '';

        if (isEmpty(user)) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (files && Object.keys(files).length > 0) {
            const uploadedContents = files.files;
            // Get file extension
            const fileExtension = imageMimeToExt[uploadedContents.mimetype];

            // Check if the file type is supported
            if (!fileExtension) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }
            if (uploadedContents.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 10MB" });
            } else {
                const file_on_s3 = await uploadFileToS3(uploadedContents, bucketPath);
                contentLink = file_on_s3.location;
                rekognitionResult = await moderateContent(`${bucketPath}/${file_on_s3.newFileName}`, contentType);
            }
            const newAsset = new Asset({
                userId: userId,
                url: contentLink,
                category: "profilePicture",
                type: "image",
                blocked: rekognitionResult.success ? false : true
            })
            await newAsset.save();

            if (rekognitionResult.success == false) {
                return res.status(400).json({ success: false, message: "The uploaded image or video contains inappropriate content" });
            }
            user.profilePicture = newAsset.url;
            await user.save();
            return res.status(200).json({ success: true, url: user.profilePicture });

        } else {
            return res.status(400).json({ success: false, message: "Invalid Request!" })
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.uploadCoverPicture = async (req, res) => {
    try {
        const files = req.files;
        const userId = req.user.id;
        const user = await User.findOne({ _id: userId });
        const bucketPath = 'CoverPicture';
        const maxFileSizeBytes = 10000000;
        const contentType = "image";
        let contentLink, rekognitionResult = '';

        if (isEmpty(user)) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (files && Object.keys(files).length > 0) {
            const uploadedContents = files.files;
            // Get file extension
            const fileExtension = imageMimeToExt[uploadedContents.mimetype];

            // Check if the file type is supported
            if (!fileExtension) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }
            if (uploadedContents.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 10MB" });
            } else {
                const file_on_s3 = await uploadFileToS3(uploadedContents, bucketPath);
                contentLink = file_on_s3.location;
                rekognitionResult = await moderateContent(`${bucketPath}/${file_on_s3.newFileName}`, contentType);
            }
            const newAsset = new Asset({
                userId: userId,
                url: contentLink,
                category: "profilePicture",
                type: "image",
                blocked: rekognitionResult.success ? false : true
            })
            await newAsset.save();

            if (rekognitionResult.success == false) {
                return res.status(400).json({ success: false, message: "The uploaded image or video contains inappropriate content" });
            }
            user.coverPicture = newAsset.url;
            await user.save();
            return res.status(200).json({ success: true, url: user.coverPicture });

        } else {
            return res.status(400).json({ success: false, message: "Invalid Request!" })
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.addNumberOfViews = async (req, res) => {
    try {
        const assetId = req.body.assetId;
        const asset = await Asset.findOne({ _id: assetId });
        if (isEmpty(asset)) {
            return res.status(400).json({ success: false, message: 'The asset does not exist.' });
        }
        asset.numberOfViews += 1;
        await asset.save();
        return res.status(200).json({ success: true, numberOfViews: asset.numberOfViews });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getUploadedContents = async (req, res) => {
    const { page, type, userId } = req.body;
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
            userId: userId || req.user.id,
            ...typeFilter,
            purpose: { $in: ['uploadedImage', 'uploadedVideo'] }
        })
            .sort({ uploadedTime: -1 }) // Sort by updated time, descending
            .limit(per_page)
            .skip(skip)
            .select('_id url numberOfViews numberOfLikes numberOfComments caption uploadedTime isLike');
        return res.status(200).json({ success: true, assets: assets });
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