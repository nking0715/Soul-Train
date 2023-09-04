const aws = require('aws-sdk');
const fs = require('fs');
const stream = require('stream');
const dateFormat = require('date-and-time');
const path = require('path');

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.REGION,
    correctClockSkew: true,
    httpOptions: { timeout: 1800000 }
})

exports.uploadFileToS3 = async (file, filepath) => {
    let extdotname = path.extname(file.name);
    let ext = extdotname.slice(1);
    let name = dateFormat.format(new Date(), "YYYYMMDDHHmmss")+ "." +ext;
    
    const fileStream = new stream.PassThrough();
    fileStream.end(file.data);
    const uploadedFile = await s3.upload({
        Bucket: `${process.env.AWS_BUCKET_NAME}/${filepath}`,
        Key: name,
        ContentType: file.mimetype,
        Body: fileStream,
        ACL: 'public-read'
    }).promise();

    return uploadedFile.Location;
}

exports.exportCSVToS3 = async (csvData, fileName, path) => {
    const uploadedFile = await s3.upload({
        Bucket: `${process.env.BUCKET_NAME}/${path}`,
        Key: fileName,
        Body: csvData,
    }).promise();

    return uploadedFile.Location;
}

exports.getFileExisting = async (fileName, path) => {
    try {
        const result = await s3.headObject({ Bucket: `${process.env.BUCKET_NAME}/${path}`, Key: fileName }).promise();
        return true;
    } catch (error) {
        if (error.statusCode === 404) {
            return false;
        } else {
            throw error;
        }
    }
}
