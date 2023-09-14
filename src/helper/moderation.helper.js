// const aws = require('aws-sdk');
// const fs = require('fs');
// const stream = require('stream');
// const dateFormat = require('date-and-time');
// const path = require('path');

// const s3 = new aws.S3({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.REGION,
//     correctClockSkew: true,
//     httpOptions: { timeout: 1800000 }
// })

// Initialize AWS Rekognition
// aws.config.update({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.REGION,
// });
// const rekognition = new aws.Rekognition();

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

// exports.moderateImage = async (file) => {
//   try {
//     console.log("file ", file)
//     // Read the image file
//     const bitmap = file.buffer;
//     console.log("bitmap ===", bitmap)
//     const params = {
//       Image: {
//         Bytes: bitmap,
//       },
//       MinConfidence: 50,
//     };

//     rekognition.detectModerationLabels(params, (err, data) => {
//       if (err) {
//         console.log("Error 1 ", err, err.stack);
//       }
//       console.log("data ===", data)
//       // Check if inappropriate content is found
//       const isSafe = !data.ModerationLabels.length;

//       res.json({
//         isSafe,
//         labels: data.ModerationLabels,
//       });
//     });
//   } catch (error) {
//     console.error('Error: 2', error);
//   }
// }

const { Rekognition } = require('aws-sdk');

const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.REGION,
}); // replace 'us-east-1' with the actual region you want to use

const rekognition = new AWS.Rekognition();

const forbiddenLabels = [
  'Explicit Nudity',
  'Violence',
  'Visually Disturbing',
  'Rude Gestures',
  'Tobacco',
  'Gambling',
  'Hate Symbols',
];

exports.moderateImage = async (imagePath) => {
  console.log("Image path ===", imagePath)
  const params = {
    Image: {
      S3Object: {
        Bucket: 'images',
        Name: imagePath,
      },
    },
    MinConfidence: 70,
  };
  const { ModerationLabels } = await rekognition.detectModerationLabels(params).promise();
  // If no labels found -> image doesn't contain any forbidden content
  if (!ModerationLabels || ModerationLabels.length === 0) {
    return [];
  }
  console.log("ModerationLabels ", ModerationLabels)
  // If some labels found -> compare them with forbidden labels
  const labels = ModerationLabels.map((label) => label.ParentName).filter(Boolean);
  console.log('Found labels:', JSON.stringify(labels));

  const foundForbiddenLabels = labels.filter((label) => forbiddenLabels.includes(label));
  console.log('Found forbidden labels:', JSON.stringify(foundForbiddenLabels));
  return foundForbiddenLabels;
}
