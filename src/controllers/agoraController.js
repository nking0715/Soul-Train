const {RtcTokenBuilder, RtcRole} = require('agora-access-token');
require('dotenv').config();

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

exports.generateAccessToken = async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    const channelName = req.body.channelName;
    if (!channelName) {
        return res.status(500).json({ 'error': 'channel is required' });
    }
    // get uid 
    let uid = req.body.uid;
    if (!uid || uid == '') {
        uid = 0;
    }
    // get role
    let role = RtcRole.SUBSCRIBER;
    if (req.body.role == 'publisher') {
        role = RtcRole.PUBLISHER;
    }
    // get the expire time
    let expireTime = req.body.expireTime;
    if (!expireTime || expireTime == '') {
        expireTime = 3600;
    } else {
        expireTime = parseInt(expireTime, 10);
    }
    // calculate privilege expire time
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;
    const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
    return res.json({ 'token': token });
};
