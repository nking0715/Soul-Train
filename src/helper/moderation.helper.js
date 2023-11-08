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
  'Tobacco',
  'Gambling',
  'Hate Symbols',
];

exports.moderateContent = async (filePath, contentType) => {
  if (contentType === 'image') {
    return moderateImage(filePath);
  } else if (contentType === 'video') {
    return moderateVideo(filePath);
  } else {
    return { success: false, reason: 'Unsupported content type' };
  }
};

async function moderateImage(filePath) {
  const params = {
    Image: {
      S3Object: {
        Bucket: 'soul-train-bucket',
        Name: filePath,
      },
    },
    MinConfidence: 70,
  };
  const { ModerationLabels } = await rekognition.detectModerationLabels(params).promise();
  console.log("Image ModerationLabels ", ModerationLabels);
  if (!ModerationLabels || ModerationLabels.length === 0) {
    return { success: true };
  }

  const labels = ModerationLabels.map((label) => label.ParentName).filter(Boolean);
  const foundForbiddenLabels = labels.filter((label) => forbiddenLabels.includes(label));
  console.log("Image foundForbiddenLabels", foundForbiddenLabels);
  return { success: false, foundForbiddenLabels };
}

async function moderateVideo(filePath) {
  const params = {
    Video: {
      S3Object: {
        Bucket: 'soul-train-bucket',
        Name: filePath,
      },
    },
    MinConfidence: 70,
  };

  const { JobId } = await rekognition.startContentModeration(params).promise();
  let moderationResponse;
  do {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // wait 5 seconds
    moderationResponse = await rekognition.getContentModeration({ JobId }).promise();
  } while (moderationResponse.JobStatus === 'IN_PROGRESS');

  if (moderationResponse.JobStatus === 'FAILED') {
    return { success: false, reason: 'Moderation failed' };
  }

  const labels = moderationResponse.ModerationLabels.map((label) => label.ParentName).filter(Boolean);
  const foundForbiddenLabels = labels.filter((label) => forbiddenLabels.includes(label));
  return { success: foundForbiddenLabels.length === 0, reason: foundForbiddenLabels };
}
