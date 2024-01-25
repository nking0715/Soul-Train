const { async } = require('@firebase/util');
const axios = require('axios');
const AWS = require('aws-sdk');
const util = require('util');
require('dotenv').config();

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.REGION,
}); // replace 'us-east-1' with the actual region you want to use
  
const s3 = new AWS.S3();
// Convert s3.getSignedUrl to return a Promise
const getSignedUrlPromise = util.promisify(s3.getSignedUrl.bind(s3));

exports.generateRandomChannelName = (length = 12) => {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        result += charset.charAt(randomIndex);
    }
    return result;
};

exports.getSignedUrl = async (objectKey) => {
    const expiryDuration = 60 * 60 * 24; // 24 hours
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME, // Use the environment variable
        Key: objectKey, // Replace with the object key
        Expires: expiryDuration // Expiry time in seconds
    };

    try {
        const url = await getSignedUrlPromise('getObject', params);
        return url;
    } catch (err) {
        console.error(err);
        throw err; // or handle error as needed
    }
};
