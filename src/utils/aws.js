const aws = require('aws-sdk');
const stream = require('stream');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.REGION,
    correctClockSkew: true,
    httpOptions: { timeout: 1800000 }
})

exports.uploadFileToS3 = async (file, newFileName, filepath) => {
    const fileStream = new stream.PassThrough();
    fileStream.end(file.data);
    const uploadedFile = await s3.upload({
        Bucket: `${process.env.AWS_BUCKET_NAME}/${filepath}`,
        Key: newFileName,
        ContentType: file.mimetype,
        Body: fileStream,
        ACL: 'public-read'
    }).promise();

    return { location: uploadedFile.Location, newFileName };
}

exports.uploadImageThumbnailToS3 = async (s3Url, keyPrefix) => {
    const filePath = "Post";
    const newFileName = keyPrefix + '_thumbnail.jpg';
    const parsedUrl = new URL(s3Url);
    const pathSegments = parsedUrl.pathname.split('/');
    const key = pathSegments.pop();
    const objectData = await s3.getObject({
        Bucket: `${process.env.AWS_BUCKET_NAME}/${filePath}`,
        Key: key
    }).promise();
    const resizedBuffer = await sharp(objectData.Body)
        .resize(300, 300)
        .toBuffer();
    const promise = s3.upload({
        Bucket: `${process.env.AWS_BUCKET_NAME}/${filePath}`,
        Key: newFileName,
        ContentType: 'image/jpeg',
        Body: resizedBuffer,
        ACL: 'public-read'
    }).promise();

    return promise;
};


exports.uploadVideoThumbnailToS3 = async (videoPath, keyPrefix) => {
    try {
        const url = new URL(videoPath);
        const pathSegments = url.pathname.split('/');
        const key = pathSegments.pop();
        const filePath = 'Post';
        const newFileName = keyPrefix + '_thumbnail.jpg';

        // Get the video stream from S3
        const videoStream = s3.getObject({
            Bucket: `${process.env.AWS_BUCKET_NAME}/${filePath}`,
            Key: key
        }).createReadStream();

        // Create a buffer to hold the thumbnail
        let thumbnailBuffer = Buffer.from([]);

        // Use FFmpeg to generate a thumbnail
        await new Promise((resolve, reject) => {
            ffmpeg(videoStream)
                .screenshots({
                    timestamps: [1],
                    filename: newFileName,
                    folder: '/',
                    size: '300x300'
                })
                .on('data', (chunk) => {
                    console.log(chunk);
                    thumbnailBuffer = Buffer.concat([thumbnailBuffer, chunk]);
                })
                .on('end', () => {
                    console.log('Thumbnail generation finished.');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error generating thumbnail:', err);
                    reject(err);
                });
        });

        // Upload the thumbnail to S3
        const uploadResponse = await s3.upload({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${filePath}/${newFileName}`,
            ContentType: 'image/jpeg',
            Body: thumbnailBuffer,
            ACL: 'public-read'
        }).promise();

        return uploadResponse;
    } catch (err) {
        console.error('Error in uploadVideoThumbnailToS3:', err);
        throw err;
    }
};