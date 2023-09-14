const aws = require('aws-sdk');
const fs = require('fs');
const stream = require('stream');
const dateFormat = require('date-and-time');
const path = require('path');

// const s3 = new aws.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.REGION,
//     correctClockSkew: true,
//     httpOptions: { timeout: 1800000 }
// })

// Initialize AWS Rekognition
aws.config.update({ region: process.env.REGION });
const rekognition = new aws.Rekognition();

// exports.uploadFileToS3 = async (file, filepath) => {
//     let extdotname = path.extname(file.name);
//     let ext = extdotname.slice(1);
//     let name = dateFormat.format(new Date(), "YYYYMMDDHHmmss")+ "." +ext;

//     const fileStream = new stream.PassThrough();
//     fileStream.end(file.data);
//     const uploadedFile = await s3.upload({
//         Bucket: `${process.env.AWS_BUCKET_NAME}/${filepath}`,
//         Key: name,
//         ContentType: file.mimetype,
//         Body: fileStream,
//         ACL: 'public-read'
//     }).promise();

//     return uploadedFile.Location;
// }

exports.moderateImage = async (file) => {
  try {
    // Read the image file
    const bitmap = Buffer.from(file.buffer);

    const params = {
      Image: {
        Bytes: bitmap,
      },
      MinConfidence: 50,
    };

    rekognition.detectModerationLabels(params, (err, data) => {
      if (err) {
        console.log("Error 1 ", err, err.stack);
        res.status(500).json({ error: 'Error processing image' });
        return;
      }
      console.log("data ===", data)
      // Check if inappropriate content is found
      const isSafe = !data.ModerationLabels.length;
      
      res.json({
        isSafe,
        labels: data.ModerationLabels,
      });
    });
  } catch (error) {
    console.error('Error: 2', error);
    res.status(500).json({ error: 'An error occurred' });
  }
}
