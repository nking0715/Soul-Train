const aws = require('aws-sdk');
const stream = require('stream');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const tmp = require('tmp');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

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

exports.uploadFileToS3Multipart = async (file, newFileName) => {
    // Step 1: Initiate multipart upload
    const createUploadResponse = await s3.createMultipartUpload({
        Bucket: `${process.env.AWS_BUCKET_NAME}`,
        Key: newFileName,
        ContentType: file.mimetype,
        ACL: 'public-read'
    }).promise();

    const uploadId = createUploadResponse.UploadId;

    try {
        // Step 2: Upload parts
        const partSize = 5 * 1024 * 1024; // 1 MB per part
        const parts = splitFileIntoParts(file.data, partSize);
        const uploadPromises = parts.map((part, index) => uploadPart(s3, part, index + 1, uploadId, newFileName));

        const uploadedParts = await Promise.all(uploadPromises);

        // Step 3: Complete multipart upload
        const completeUploadResponse = await s3.completeMultipartUpload({
            Bucket: `${process.env.AWS_BUCKET_NAME}`,
            Key: newFileName,
            UploadId: uploadId,
            MultipartUpload: { Parts: uploadedParts }
        }).promise();

        console.log('completeUploadResponse: ', completeUploadResponse);

        return { location: completeUploadResponse.Location, newFileName };
    } catch (error) {
        // Step 4: Abort multipart upload on failure
        await s3.abortMultipartUpload({
            Bucket: `${process.env.AWS_BUCKET_NAME}`,
            Key: newFileName,
            UploadId: uploadId
        }).promise();
        throw error;
    }
};

const uploadPart = async (s3, partData, partNumber, uploadId, fileName) => {
    const response = await s3.uploadPart({
        Bucket: `${process.env.AWS_BUCKET_NAME}`,
        Key: fileName,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: partData
    }).promise();

    return { ETag: response.ETag, PartNumber: partNumber };
}

const splitFileIntoParts = (fileData, partSize) => {
    const parts = [];
    for (let i = 0; i < fileData.length; i += partSize) {
        const part = fileData.slice(i, i + partSize);
        parts.push(part);
    }
    return parts;
}


exports.uploadImageThumbnailToS3 = async (s3Url, keyPrefix) => {
    const filePath = "Post";
    const newFileName = keyPrefix + '_thumbnail.jpg';
    const objectData = await s3.getObject({
        Bucket: `${process.env.AWS_BUCKET_NAME}`,
        Key: s3Url
    }).promise();
    const resizedBuffer = await sharp(objectData.Body)
        .resize(null, 180)
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
        console.log('videoPath: ', videoPath);
        const filePath = 'Post';
        const newFileName = keyPrefix + '_thumbnail.jpg';

        // Create a temporary file for the thumbnail
        const tempFilePath = `./${newFileName}`;

        // Get the video stream from S3
        const videoStream = s3.getObject({
            Bucket: `${process.env.AWS_BUCKET_NAME}`,
            Key: videoPath
        }).createReadStream();
        const tempVideoPath = tmp.tmpNameSync({ postfix: '.mp4' });
        await pipeline(videoStream, fs.createWriteStream(tempVideoPath));

        // Generate the thumbnail
        await new Promise((resolve, reject) => {
            ffmpeg(tempVideoPath)
                .screenshots({
                    timestamps: ['50%'],
                    filename: tempFilePath,
                    size: '?x180'
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

        // Read the thumbnail file into a buffer
        const thumbnailBuffer = fs.readFileSync(tempFilePath);

        // Upload the thumbnail to S3
        const uploadResponse = await s3.upload({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${filePath}/${newFileName}`,
            ContentType: 'image/jpeg',
            Body: thumbnailBuffer,
            ACL: 'public-read'
        }).promise();

        // Optional: Clean up the temporary file
        fs.unlinkSync(tempFilePath);
        fs.unlinkSync(tempVideoPath);

        return uploadResponse.Location;
    } catch (err) {
        console.error('Error in uploadVideoThumbnailToS3:', err);
        return "s3://soul-train-bucket/Post/chess.png";
    }
};