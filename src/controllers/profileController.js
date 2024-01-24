const dateFormat = require('date-and-time');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const Asset = require('../models/asset');
const Post = require('../models/post');
const FcmToken = require('../models/fcmToken');
const Notification = require('../models/notification');
const { validationResult } = require('express-validator');
const isEmpty = require('../utils/isEmpty')
const { uploadFileToS3, deleteAssetsFromS3 } = require('../utils/aws');
const { parseQueryParam } = require('../utils/queryUtils');
const authService = require('../services/authService');
const { moderateContent } = require('../helper/moderation.helper')
const { sendPushNotification } = require('../utils/notification');

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

let PROFILE_PICTURE_BUCKET_PATH, COVER_PICTURE_BUCKETPATH;
if (process.env.NODE_ENV == "live") {
    PROFILE_PICTURE_BUCKET_PATH = process.env.LIVE_PROFILE_PICTURE_BUCKET_PATH;
    COVER_PICTURE_BUCKETPATH = process.env.LIVE_COVER_PICTURE_BUCKETPATH;
} else {
    PROFILE_PICTURE_BUCKET_PATH = process.env.DEV_PROFILE_PICTURE_BUCKET_PATH
    COVER_PICTURE_BUCKETPATH = process.env.DEV_COVER_PICTURE_BUCKETPATH;
}

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.query.userId || req.user.id })
            .select('username artistName bio style  profilePicture coverPicture numberOfFollowers numberOfFollowings hasChangedArtistName emailVerified email phoneNumber');
        if (isEmpty(user)) return res.status(400).json({ success: false, message: 'Profile not found' });

        let profile = user.toObject();
        // Remove private fields if the requester isn't the profile owner
        if (req.user.id !== profile._id.toString()) {
            delete profile.email;
            delete profile.phoneNumber;
            const user = await User.findOne({ _id: req.query.userId })
                .select('follower')
            const follower = user.follower;
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
        const { page = 1, userId, perPage = 10 } = req.query;
        const pageConverted = parseQueryParam(page, 1);
        const perPageConverted = parseQueryParam(perPage, 10);
        const skip = (pageConverted - 1) * perPageConverted; // Calculate the skip value
        const currentUser = await User.findOne({ _id: req.user.id })
            .select('following');
        const user = await User.findOne({ _id: userId || req.user.id })
            .select('follower');
        const followersList = await User.find({ _id: { $in: user.follower } })
            .limit(perPageConverted)
            .skip(skip)
            .select('username artistName profilePicture');
        const followers = followersList.map(follower => {
            const followed = currentUser.following.some(followingId => followingId.toString() === follower._id.toString());
            return { ...follower.toObject(), followed }; // Add the new key here
        });
        return res.status(200).json({ success: true, followers });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getFollowingList = async (req, res) => {
    try {
        const { page = 1, userId, perPage = 10 } = req.query;
        const pageConverted = parseQueryParam(page, 1);
        const perPageConverted = parseQueryParam(perPage, 10);
        const skip = (pageConverted - 1) * perPageConverted; // Calculate the skip value
        const userToSearch = userId || req.user.id;
        const currentUser = await User.findOne({ _id: req.user.id })
            .select('following');
        const user = await User.findById(userToSearch)
            .select('following');
        const followingsList = await User.find({ _id: { $in: user.following } })
            .limit(perPageConverted)
            .skip(skip)
            .select('username artistName profilePicture');
        const followings = followingsList.map(following => {
            const followed = currentUser.following.some(followerId => followerId.toString() === following._id.toString());
            return { ...following.toObject(), followed }; // Add the new key here
        });
        return res.status(200).json({ success: true, followings });
    } catch (error) {
        console.log(error.message);
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

        return res.status(200).json({ success: true, token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findOne({ _id: req.user.id });
        if (!user) return res.status(400).json({ success: false, message: "User doesn't exist!" });

        const validPassword = await bcrypt.compare(currentPassword, user.password ? user.password : "");
        if (!validPassword) return res.status(400).json({ success: false, message: "Wrong password" });

        user.password = newPassword;
        await user.save();

        return res.status(200).json({ success: true, message: "Successfully updated the password" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.uploadProfilePicture = async (req, res) => {
    try {
        const files = req.files;
        const userId = req.user.id;
        const user = await User.findOne({ _id: userId });
        const bucketPath = PROFILE_PICTURE_BUCKET_PATH;
        const maxFileSizeBytes = 10000000;
        const contentType = "image";
        let contentLink, rekognitionResult = '';

        if (isEmpty(user)) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (files && Object.keys(files).length > 0) {
            const uploadedContent = files.files;
            // Get file extension
            const fileExtension = imageMimeToExt[uploadedContent.mimetype];

            // Check if the file type is supported
            if (!fileExtension) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }
            if (uploadedContent.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 10MB" });
            } else {
                const key_prefix = dateFormat.format(new Date(), "YYYYMMDDHHmmss");
                const newFileName = key_prefix + fileExtension;
                const file_on_s3 = await uploadFileToS3(uploadedContent, newFileName, bucketPath);
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
            if (user.profilePicture) {
                const existingAsset = await Asset.find({ url: user.profilePicture });
                await deleteAssetsFromS3([existingAsset]);
                await Asset.findByIdAndRemove(existingAsset._id);
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
        const bucketPath = COVER_PICTURE_BUCKETPATH;
        const maxFileSizeBytes = 10000000;
        const contentType = "image";
        let contentLink, rekognitionResult = '';

        if (isEmpty(user)) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (files && Object.keys(files).length > 0) {
            const uploadedContent = files.files;
            // Get file extension
            const fileExtension = imageMimeToExt[uploadedContent.mimetype];

            // Check if the file type is supported
            if (!fileExtension) {
                return res.status(400).json({ success: false, message: 'Unsupported file type' });
            }
            if (uploadedContent.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 10MB" });
            } else {
                const key_prefix = dateFormat.format(new Date(), "YYYYMMDDHHmmss");
                const newFileName = key_prefix + fileExtension;
                const file_on_s3 = await uploadFileToS3(uploadedContent, newFileName, bucketPath);
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
            if (user.coverPicture) {
                const existingAsset = await Asset.find({ url: user.coverPicture });
                deleteAssetsFromS3([existingAsset]);
                await Asset.findByIdAndRemove(existingAsset._id);
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
        const postId = req.body.postId;
        const post = await Post.findOne({ _id: postId });
        if (isEmpty(post)) {
            return res.status(400).json({ success: false, message: 'The post does not exist.' });
        }
        post.numberOfViews += 1;
        await post.save();
        return res.status(200).json({ success: true, numberOfViews: post.numberOfViews });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
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

        const userId = req.user.id;

        if (dancerId == userId) return res.status(400).json({ success: false, message: 'User cannot follow or unfollow himself/herself.' })

        const dancer = await User.findOne({ _id: dancerId });
        const user = await User.findOne({ _id: userId })

        if (isEmpty(dancer) || isEmpty(user)) return res.status(404).json({ success: false, message: 'User Not found' });

        if (user.following.includes(dancerId)) {
            const userIndex = user.following.indexOf(dancerId);
            user.following.splice(userIndex, 1);

            const dancerIndex = dancer.follower.indexOf(userId)
            dancer.follower.splice(dancerIndex, 1);
        } else {
            user.following.push(dancerId);
            dancer.follower.push(userId);
            const data = {
                type: 'Follow User',
                followerId: userId.toString(),
                publisher: userId.toString(),
            }
            const pushNotification = {
                title: 'A user followed you.',
                body: `${user.artistName} started to follow you.`
            }
            const appNotification = {
                title: `${user.artistName}`,
                body: `started following you.`
            }
            const newNotification = new Notification({
                usersToRead: [dancerId],
                data: data,
                notification: appNotification
            });
            data.notificationId = newNotification._id.toString();
            await newNotification.save();
            const fcmToken = await FcmToken.findOne({ userId: dancerId });
            if (!isEmpty(fcmToken)) {
                const sendNotificationResult = await sendPushNotification(fcmToken.token, data, pushNotification);
                if (!sendNotificationResult) {
                    console.log('Notification for follow user was not sent.');
                }
            }
        }
        await user.save();
        await dancer.save();

        return res.status(200).json({ success: true, message: `Successfully ${user.following.includes(dancerId) ? 'followed' : 'unfollowed'} the dancer.` });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}