const { RtcTokenBuilder, RtcRole } = require('agora-token');
const Channel = require('../models/channel');
const User = require('../models/user');
const FcmToken = require('../models/fcmToken');
const Notification = require('../models/notification');
const socketManager = require('../utils/socket');
const { sendPushNotification } = require('../utils/notification');
require('dotenv').config();

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

exports.createChannel = async (req, res) => {
    try {
        const { channelType, audienceType } = req.body;
        const userId = req.user.id;
        const channel = await Channel.findOne({ userId: userId });

        // Check if the request is valid
        if (isEmpty(channelType)) {
            return res.status(400).json({ success: false, message: 'The ChannelType is required.' });
        }
        if (isEmpty(audienceType)) {
            return res.status(400).json({ success: false, message: 'The AudienceType is required.' });
        }

        // Check if the user has already created a channel.
        if (!isEmpty(channel)) {
            return res.status(400).json({ success: false, message: 'The channel for this user already exists.' });
        }

        const channelName = generateRandomChannelName();
        const role = RtcRole.PUBLISHER;
        const token = generateAccessToken(channelName, role, 0);

        const newChannel = new Channel({
            userId: req.user.id,
            channelType: channelType,
            audienceType: audienceType,
            channelName: channelName,
            uid: [0]
        });

        const user = await User.findOne({ _id: userId }).select('follower artistName');
        const followers = user.follower;

        const data = {
            type: 'Live Streaming',            
            publisher: userId.toString(),
            channelId: newChannel._id.toString(),
            channelName: newChannel.channelName
        }
        const pushNotification = {
            title: 'Live Stream Started!',
            body: `${user.artistName} is starting a live stream, check it out!`
        }
        const appNotification = {
            title: `${user.artistName}`,
            body: `is live now.`
        }
        const newNotification = new Notification({
            usersToRead: followers,
            data: data,
            notification: appNotification
        });
        data.notificationId = newNotification._id.toString();
        await newNotification.save();
        const fcmTokenList = await FcmToken.find({ userId: { $in: followers || [] } });
        if (!isEmpty(fcmTokenList)) {
            const fcmTokens = [];
            fcmTokenList.map((fcmToken) => {
                fcmTokens.push(fcmToken.token);
            });
            const sendNotificationResult = await sendPushNotification(fcmTokens, data, pushNotification);
            if (!sendNotificationResult) {
                return res.status(500).json({ success: false, message: 'Notification was not sent.' });
            }            
        }
        await newChannel.save();
        return res.status(200).json({ success: true, token: token, channelName: channelName });
    } catch (error) {
        console.log('Error in createChannel: ', error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

exports.getChannels = async (req, res) => {
    try {
        const isHomeFeed = req.body.isHomeFeed;
        if (isEmpty(isHomeFeed)) {
            return res.status(400).json({ success: false, message: "A key is missing." });
        }
        if (isHomeFeed) {
            const userIDsOfChannelsFollowedByRequestingUser = await User.find({
                follower: { $in: [req.user.id] }
            }).select('_id');  // This will return an array of user IDs that the requesting user follows.

            const channelUserIDs = userIDsOfChannelsFollowedByRequestingUser.map(user => user._id);

            const channels = await Channel.find({
                userId: { $in: channelUserIDs }
            }).populate('userId', 'username profilePicture');

            return res.status(200).json({ success: true, channels: channels });
        } else {
            const userIDsOfChannelsFollowedByRequestingUser = await User.find({
                follower: { $in: [req.user.id] }
            }).select('_id');  // This will return an array of user IDs that the requesting user follows.

            const channelUserIDs = userIDsOfChannelsFollowedByRequestingUser.map(user => user._id);

            const channels = await Channel.find({
                audienceType: "all",
                userId: { $nin: channelUserIDs }
            }).populate('userId', 'username profilePicture');
            return res.status(200).json({ success: true, channels: channels });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.joinChannel = async (req, res) => {
    try {
        const channelId = req.body.channelId;

        if (isEmpty(channelId)) {
            return res.status(400).json({ success: false, message: 'The channelId is required' });
        }

        const channel = await Channel.findOne({ _id: channelId });

        if (isEmpty(channel)) {
            return res.status(400).json({ success: false, message: 'The channel does not exist.' });
        }

        const channelName = channel.channelName;
        let uid;

        do {
            uid = Math.floor(Math.random() * 1000) + 1;
        } while (!checkUIDForChannelName(channelName, uid));// Assuming checkUIDForChannelName checks if the uid already exists for the channel

        channel.uid.push(uid); // Pushing the new UID to the array
        await channel.save(); // Saving the channel document with the new UID

        const role = RtcRole.SUBSCRIBER;
        const token = generateAccessToken(channelName, role, 0);

        return res.status(200).json({ success: true, token: token, uid: uid, channelName: channelName });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteChannel = async (req, res) => {
    const userId = req.user.id;
    try {
        await Channel.deleteOne({ userId: userId });
        return res.status(200).json({ success: true, message: 'Channel successfully removed.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.contentModerationWebhook = async (req, res) => {
    const { contentUrl, status, userId, addedAt, contentId, reason, metaData } = req.body;
    try {
        /* const fcmToken = await FcmToken.findOne({ userId: userId });
        if (!isEmpty(fcmToken)) {
            const data = {
                type: 'Post Flagged',
                postId: newPost._id.toString()
            }
            const notification = {
                title: 'The post was flagged as inappropriate.',
                body: `Your post was rejected due to inappropriate content.`
            }
            const newNotification = new Notification({
                usersToRead: [userId],
                data: data,
                notification: notification
            });
            data.notificationId = newNotification._id.toString();
            const sendNotificationResult = await sendPushNotification([fcmToken.token], data, notification);
            if (!sendNotificationResult) {
                return res.status(500).json({ success: false, message: 'Notification was not sent.' });
            }
            await newNotification.save();
        } */
        return res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

const checkUIDForChannelName = async (targetChannelName, targetUID) => {
    try {
        const channelsWithTargetName = await Channel.find({
            channelName: targetChannelName
        });

        const uids = channelsWithTargetName.map(channel => channel.uid);

        return uids.includes(targetUID);

    } catch (err) {
        console.error('Error checking uid:', err);
    }
}

const generateRandomChannelName = (length = 12) => {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        result += charset.charAt(randomIndex);
    }
    return result;
};

// Generate access token for Agora
const generateAccessToken = (channelName, role, uid) => {
    // Calculate privilege expire time
    const expireTime = 3600;
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    // Build and return the token
    const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
    return token;
};