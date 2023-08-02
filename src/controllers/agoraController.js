const { RtcTokenBuilder, RtcRole } = require('agora-token');
const Channel = require('../models/channel');
require('dotenv').config();

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

// Generate access token for Agora
exports.generateAccessToken = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');

    const channelName = req.body.channelName;
    if (!channelName) {
        return res.status(500).json({ error: 'channel is required' });
    }

    // Get uid
    let uid = req.body.uid;
    if (!uid || uid == '') {
        uid = 0;
    }

    // Get role
    let role;
    if (req.body.role === 'publisher') {
        role = RtcRole.PUBLISHER;

        // Create a new Channel document for the publisher
        const channel = new Channel({
            channelID: channelName,
            creatorID: uid
        });
        await channel.save();
    } else if (req.body.role === 'audience') {
        role = RtcRole.SUBSCRIBER;

        // Add participant ID to the existing Channel document for the audience
        await Channel.updateOne({ channelID: channelName }, { $push: { participantID: uid } });
    } else {
        return res.status(500).json({ error: 'role is incorrect' });
    }

    // Get the expire time
    let expireTime = req.body.expireTime;
    if (!expireTime || expireTime == '') {
        expireTime = 3600;
    } else {
        expireTime = parseInt(expireTime, 10);
    }

    // Calculate privilege expire time
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    // Build and return the token
    const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
    return res.json({ token });
};