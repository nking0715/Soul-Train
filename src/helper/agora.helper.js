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


exports.getRequireResourceId = (channelName, uid) => {
    return new Promise(async (resolve, reject) => {
        const requestBody = {
            'cname': channelName,
            'uid': String(uid),
            'clientRequest': {}
        };

        try {
            const response = await axios.post(`https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`, requestBody, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(CUSTONER_KEY + ":" + CUSTONER_SECRET).toString('base64')}`,
                    'Content-Type': 'application/json;charset=utf-8'
                }
            });
            if (response.data) {
                resolve(response.data.resourceId); // Resolves with the resource ID
            } else {
                reject('No data received');
            }
        } catch (error) {
            console.error('Error acquiring resource ID:', error);
            reject(error);
        }
    });
};

exports.startRecording = (resourceId, channelName, uid, token) => {
    return new Promise(async (resolve, reject) => {
        const mode = 'individual'; // Or 'composite' as needed
        const apiEndpoint = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/${mode}/start`;
        const authorization = `Basic ${Buffer.from(CUSTONER_KEY + ":" + CUSTONER_SECRET).toString('base64')}`;

        const requestData = {
            cname: channelName,
            uid: uid,
            clientRequest: {
                token: token,
                // ... additional request data
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
                resolve(response.data); // Resolve with response data
            } else {
                reject(`Failed to start recording. Status code: ${response.status}`);
            }
        } catch (error) {
            console.error('Error:', error.message);
            reject(error.message);
        }
    });
};
