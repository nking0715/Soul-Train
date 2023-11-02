const aws = require('aws-sdk');
const stream = require('stream');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const dateFormat = require('date-and-time');

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.REGION,
    correctClockSkew: true,
    httpOptions: { timeout: 1800000 }
})

exports.uploadFileToS3 = async (file, fileExtension, filepath) => {
    const fileStream = new stream.PassThrough();
    const newFileName = dateFormat.format(new Date(), "YYYYMMDDHHmmss") + fileExtension;
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
    const fileStream = new stream.PassThrough();
    const filePath = "Post";
    const newFileName = keyPrefix + '_thumbnail.jpg';
    return new Promise((resolve, reject) => {
        const params = {
            Bucket: `${process.env.AWS_BUCKET_NAME}/${filePath}`,
            Key: newFileName,
            Body: fileStream,
            ContentType: 'image/jpeg',
            ACL: 'public-read', // or as per your policy
        };

        // Start the S3 upload
        const upload = s3.upload(params, (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(data.Location); // This will be the URL of the uploaded thumbnail
        });

        // Use ffmpeg to generate the thumbnail and pipe it directly to S3
        ffmpeg(videoPath)
            .on('end', () => {
                console.log('Thumbnail generation finished.');
                fileStream.end(); // End the PassThrough stream to complete the S3 upload
            })
            .on('error', (err) => {
                console.error('Error generating thumbnail:', err);
                fileStream.destroy(err); // Destroy the stream with an error
                upload.abort(); // Abort the S3 upload
                reject(err);
            })
            .screenshots({
                timestamps: [1],
                filename: 'thumbnail.jpg',
                size: '300x300'
            })
            .pipe(fileStream, { end: false }); // Important: set `end` option to `false`
    });
}