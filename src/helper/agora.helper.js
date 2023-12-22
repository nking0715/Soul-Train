const { async } = require('@firebase/util');
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const axios = require('axios');

require('dotenv').config();
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;
const CUSTONER_KEY = process.env.CUSTONER_KEY;
const CUSTONER_SECRET = process.env.CUSTONER_SECRET;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;


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
            'cname': String(channelName),
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
            console.error('Error acquiring resource ID:', error.message);
            reject(error.message);
        }
    });
};

exports.getRecordingStatus = (resourceid, sid, mode) => {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios.get(`https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceid}/sid/${sid}/mode/${mode}/query`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(CUSTONER_KEY + ":" + CUSTONER_SECRET).toString('base64')}`,
                    'Content-Type': 'application/json;charset=utf-8'
                }
            });
            if (response.data) {
                resolve(response.data); // Resolves with the resource ID
            } else {
                reject('No recording status');
            }
        } catch (error) {
            console.error('Error recording status:', error.message);
            reject(error.message);
        }
    });
};


exports.startRecording = (resourceId, channelName, uid, token) => {
    return new Promise(async (resolve, reject) => {
        const apiEndpoint = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;
        const authorization = `Basic ${Buffer.from(CUSTONER_KEY + ":" + CUSTONER_SECRET).toString('base64')}`;

        const requestData = {
            "cname": channelName,
            "uid": uid.toString(),
            "clientRequest": {
                "token": token,
                "recordingConfig": {
                    "maxIdleTime": 90,
                    "streamTypes": 2,
                    "audioProfile": 1,
                    "channelType": 0,
                    "videoStreamType": 0,
                    "transcodingConfig": {
                        "height": 640,
                        "width": 360,
                        "bitrate": 500,
                        "fps": 15,
                        "mixedVideoLayout": 0,
                        "backgroundColor": "#000000"
                    },
                    "subscribeVideoUids": [
                        "1", "2"
                    ],
                    "subscribeAudioUids": [
                        "1"
                    ],
                    "subscribeUidGroup": 0
                },
                "recordingFileConfig": {
                    "avFileType": ["hls", "mp4"]
                },
                "storageConfig": {
                    "accessKey": AWS_ACCESS_KEY_ID,
                    "region": 0,
                    "bucket": AWS_BUCKET_NAME,
                    "secretKey": AWS_SECRET_ACCESS_KEY,
                    "vendor": 1,
                    "fileNamePrefix": [
                        "matchmaking"
                    ]
                }
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


exports.saveRecording = (resourceId, channelName, sid, uid) => {
    return new Promise(async (resolve, reject) => {
        const apiEndpoint = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`;
        const authorization = `Basic ${Buffer.from(CUSTONER_KEY + ":" + CUSTONER_SECRET).toString('base64')}`;

        const requestData = {
            "cname": (channelName).toString(),
            "uid": uid.toString(),
            "clientRequest": {
                "async_stop": false
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

exports.updateLayout = (resourceId, channelName, sid, uid, bigUid, smallUid) => {
    return new Promise(async (resolve, reject) => {
        const apiEndpoint = `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/updateLayout`;
        const authorization = `Basic ${Buffer.from(CUSTONER_KEY + ":" + CUSTONER_SECRET).toString('base64')}`;

        const requestData = {
            "cname": (channelName).toString(),
            "uid": uid.toString(),
            "clientRequest": {
                "mixedVideoLayout": 3,
                "backgroundColor": "#FF0000",
                "layoutConfig": [
                    {
                        "uid": (bigUid).toString(),
                        "x_axis": 0.0,
                        "y_axis": 0.0,
                        "width": 1.0,
                        "height": 1.0,
                        "alpha": 1.0,
                        "render_mode": 1
                    },
                    {
                        "uid": (smallUid).toString(),
                        "x_axis": 0.74,
                        "y_axis": 0.01,
                        "width": 0.25,
                        "height": 0.2,
                        "alpha": 1.0,
                        "render_mode": 1
                    }
                ]
            }
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
                reject(`Failed to updateLayout recording. Status code: ${response.status}`);
            }
        } catch (error) {
            console.error('Error:', error.message);
            reject(error.message);
        }
    });
};