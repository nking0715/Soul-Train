const { RtcTokenBuilder, RtcRole } = require('agora-token');
const Channel = require('../models/channel');
const User = require('../models/user');
require('dotenv').config();

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

exports.createChannel = async (req, res) => {
    try {
        const { channelType, audienceType } = req.body;
        const channel = await Channel.findOne({ userId: req.user.id });

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
        const token = generateAccessToken(channelName, 0);

        const newChannel = new Channel({
            userId: req.user.id,
            channelType: channelType,
            audienceType: audienceType,
            channelName: channelName,
            uid: [0]
        });
        console.log(newChannel);
        newChannel.save();

        return res.status(200).json({ success: true, token: token, channelName: channelName });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.getChannels = async (req, res) => {
    try {
        const channelsForAll = await Channel.find({ audienceType: "all" }).populate('userId', 'username profilePicture');

        const userIDsOfChannelsFollowedByRequestingUser = await User.find({
            follower: { $in: [req.user.id] }
        }).select('_id');  // This will return an array of user IDs that the requesting user follows.

        const channelUserIDs = userIDsOfChannelsFollowedByRequestingUser.map(user => user._id);

        const channelsForFollowers = await Channel.find({
            audienceType: "followers",
            userId: { $in: channelUserIDs }
        }).populate('userId', 'username profilePicture');

        const channels = [
            ...channelsForAll,
            ...channelsForFollowers
        ];

        if (channels.length === 0) {
            return res.status(204).json({ success: true, message: 'There is no active channel at the moment' });
        }

        return res.status(200).json({ success: true, channels: channels });
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

        const token = generateAccessToken(channelName, uid);

        return res.status(200).json({ success: true, token: token });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

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
const generateAccessToken = (channelName, uid) => {
    const role = RtcRole.PUBLISHER;

    // Calculate privilege expire time
    const expireTime = 3600;
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    // Build and return the token
    const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
    return token;
};