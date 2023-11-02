const aws = require('aws-sdk');
const stream = require('stream');

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.REGION,
    correctClockSkew: true,
    httpOptions: { timeout: 1800000 }
})

exports.uploadFileToS3 = async (file, filepath) => {
    const fileStream = new stream.PassThrough();
    const newFileName = Date.now().toString() + '_' + file.name;
    fileStream.end(file.data);
    const uploadedFile = await s3.upload({
        Bucket: `${process.env.AWS_BUCKET_NAME}/${filepath}`,
        Key: newFileName,
        ContentType: file.mimetype,
        Body: fileStream,
        ACL: 'public-read'
    }).promise().then(uploadData => ({
        originalName: file.name,
        newFileName,
        location: uploadData.Location
    }));

    return uploadedFile;
}