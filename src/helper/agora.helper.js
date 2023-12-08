const { async } = require('@firebase/util');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const axios = require('axios');

require('dotenv').config();
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;
const CUSTONER_KEY = process.env.CUSTONER_KEY;
const CUSTONER_SECRET = process.env.CUSTONER_SECRET;

exports.generateRandomChannelName = (length = 12) => {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        result += charset.charAt(randomIndex);
    }
    return result;
};

// Generate access token for Agora
exports.generateAccessToken = (channelName, role, uid) => {
    // Calculate privilege expire time
    const expireTime = 3600;
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    // Build and return the token
    const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
    return token;
};


exports.getRequireResourceId = async (channelName, uid) => {
    const requestBody = {
        'cname': channelName,
        'uid': String(uid),
        'clientRequest': {}
    };
    let resourceId = "";
    try {
        const response = await axios.post(`https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`, requestBody, {
            headers: {
                'Authorization': `Basic ${Buffer.from(CUSTONER_KEY + ":" + CUSTONER_SECRET).toString('base64')}`,
                'Content-Type': 'application/json;charset=utf-8'
            }
        });
        if (response.data) {
            resourceId = response.data.resourceId;
        }
        return resourceId; // This contains the resource ID
    } catch (error) {
        console.error('Error acquiring resource ID:', error);
        throw error;
    }
};


exports.startRecording = async (resourceId, channelName, uid, token) => {
    const mode = 'individual'; // Replace with 'individual' or 'composite' as needed
    const apiEndpoint = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/${mode}/start`;

    // Replace with your Base64-encoded credentials in the format "Basic <Authorization>"
    const authorization = `Basic ${Buffer.from(CUSTONER_KEY + ":" + CUSTONER_SECRET).toString('base64')}`;
    const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
    const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
    const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;
    // Replace with your channel name, recording UID, token, and other parameters
    const requestData = {
        cname: channelName,
        uid: uid,
        clientRequest: {
            token: token,
            storageConfig: {
                secretKey: AWS_SECRET_ACCESS_KEY,
                vendor: 0,
                region: 0,
                bucket: AWS_BUCKET_NAME,
                accessKey: AWS_ACCESS_KEY,
            },
            recordingConfig: {
                channelType: 0,
            },
        },
    };

    try {
        const response = await axios.post(apiEndpoint, requestData, {
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json',
            },
        });

        if (response.status === 200) {
            console.log('Recording started successfully');
            // You can handle the response data here if needed
        } else {
            console.error(`Failed to start recording. Status code: ${response.status}`);
            console.error(response.data); // Print the response for debugging
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}
