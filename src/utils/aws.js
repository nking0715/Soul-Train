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
    console.log("File ---> ", file)
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
