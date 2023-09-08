const User = require('../models/user');
const Asset = require('../models/asset');
const { validationResult } = require('express-validator');
const isEmpty = require('../utils/isEmpty')
const { uploadFileToS3 } = require('../utils/aws');
const path = require('path');

const AWS = require('aws-sdk');
const fs = require('fs');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'eu-north-1' // your desired region
});

const videoMimeToExt = {
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/mpeg': '.mpeg',
    'video/quicktime': '.mov',
    'video/x-matroska': '.mkv',
    // ... add other types as needed
};

const imageMimeToExt = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/tiff': '.tiff',
    // ... add other types as needed
};

const s3 = new AWS.S3();

exports.getProfile = async (req, res) => {
    try {
        let profile = await User.findOne({ _id: req.params.userId || req.user.id });
        if (isEmpty(profile)) return res.status(404).json({ message: 'Profile not found' });

        profile = profile.toObject();
        // Remove private fields if the requester isn't the profile owner
        if (req.user.id !== profile._id.toString()) {
            delete profile.email;
            delete profile.phoneNumber;
        }
        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { username, artistName, bio, profilePicture, coverPicture, crew, homeLocation, email, phoneNumber, style } = req.body;

        const profile = await User.findOne({ _id: req.user.id });

        if (isEmpty(profile)) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        // Check if artistName is being changed and if it has been changed before
        if (artistName && artistName !== profile.artistName && profile.hasChangedArtistName) {
            return res.status(400).json({ message: 'You can only change your artist name once.' });
        }

        if (artistName && artistName !== profile.artistName) {
            profile.hasChangedArtistName = true;
            profile.artistName = artistName;
        }

        // Update the other fields
        profile.username = username || profile.username
        profile.bio = bio || profile.bio;
        profile.profilePicture = profilePicture || profile.profilePicture;
        profile.coverPicture = coverPicture || profile.coverPicture;
        profile.crew = crew || profile.crew;
        profile.homeLocation = homeLocation || profile.homeLocation;
        profile.email = email || profile.email;
        profile.phoneNumber = phoneNumber || profile.phoneNumber;
        profile.style = style || profile.style

        await profile.save();

        // Generate a JWT token
        const token = authService.generateToken(profile);

        return res.status(200).json(profile, token);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.uploadVideo = async (req, res) => {
    const startTime = Date.now();
    try {
        const file = req.file;
        const userId = req.user.id;
        const tags = req.tags;
        const description = req.description;

        // Get file extension
        const fileExtension = videoMimeToExt[file.mimetype];

        // Check if the file type is supported
        if (!fileExtension) {
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) console.error(unlinkErr);
            });
            return res.status(400).json({ message: 'Unsupported file type' });
        }

        // Generate a unique filename with the correct extension
        const uniqueFileName = `${userId}-${Date.now()}${fileExtension}`;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: uniqueFileName,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype,
            ACL: 'public-read'
        };
        try {
            s3.upload(params, async (err, data) => {
                if (err) {
                    fs.unlink(file.path, (unlinkErr) => {
                        if (unlinkErr) console.error(unlinkErr);
                    });
                    return res.status(500).json({ error: true, Message: err });
                }
                const s3FileURL = data.Location;
                res.status(200).json({ videoUrl: s3FileURL });
                fs.unlink(file.path, (unlinkErr) => {
                    if (unlinkErr) console.error(unlinkErr);
                });
                const newVideo = new Asset({
                    userId: userId,
                    url: s3FileURL,
                    type: "video",
                    tags: tags,
                    description: description
                })
                await newVideo.save();
                // Record the end time and calculate the difference
                const endTime = Date.now();
                const uploadTime = endTime - startTime;
                console.log(`Upload successful! It took ${uploadTime} milliseconds.`);
            });
        } catch (err) {
            return res.status(500).json({ message: err.message });
        }
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
}

exports.uploadPhoto = async (req, res) => {
    const startTime = Date.now();
    try {
        const file = req.file;
        const userId = req.user.id;
        const tags = req.tags;
        const description = req.description;
        const profile = await User.findOne({ _id: userId });

        if (isEmpty(profile)) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        // Get file extension
        const fileExtension = imageMimeToExt[file.mimetype];

        // Check if the file type is supported
        if (!fileExtension) {
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) console.error(unlinkErr);
            });
            return res.status(400).json({ message: 'Unsupported file type' });
        }

        // Generate a unique filename with the correct extension
        const uniqueFileName = `${userId}-${Date.now()}${fileExtension}`;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `photos/${uniqueFileName}`, // Store photos in a 'photos' folder for organization
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype,
            ACL: 'public-read'
        };

        s3.upload(params, async (err, data) => {
            if (err) {
                fs.unlink(file.path, (unlinkErr) => {
                    if (unlinkErr) console.error(unlinkErr);
                });
                return res.status(500).json({ error: true, message: err });
            }

            const s3FileURL = data.Location;
            res.status(200).json({ photoUrl: s3FileURL });
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) console.error(unlinkErr);
            });

            const newPhoto = new Asset({
                userId: userId,
                url: s3FileURL,
                type: "photo",
                tags: tags,
                description: description
            })
            await newPhoto.save();
            const endTime = Date.now();
            const uploadTime = endTime - startTime;
            console.log(`Photo upload successful! It took ${uploadTime} milliseconds.`);
        });

    } catch (err) {
        res.status(400).json({ message: err.message });
    }
}

exports.uploadImage = async (req, res) => {
    var imageLink = '';
    const files = req.files;
    try {
        if (req.files && Object.keys(req.files).length > 0) {
            let uploadImage = req.files.image;
            let allowedExtensions = /(\.jpg|\.jpeg|\.png|\.gif)$/i;
            let maxFileSizeBytes = 2000000; // At least 2MB
            let extdotname = path.extname(uploadImage.name);
            var ext = extdotname.slice(1);
            if (!allowedExtensions.exec(extdotname)) {
                return res.status(400).json({ success: false, message: "Please upload the exact image type (png, jpg, jpeg or gif)" });
            } else if (uploadImage.size > maxFileSizeBytes) {
                return res.status(400).json({ success: false, message: "File size should be less than 2MB" });
            } else {
                for (const key of Object.keys(files)) {
                    const file = files[key];
                    const file_on_s3 = await uploadFileToS3(file, "images");
                    imageLink = file_on_s3;
                    break;
                }
            }
        } else {
            return res.status(400).json({ success: false, message: "You didn't upload image" });
        }
        return res.status(200).json({ success: true, message: "success", imageLink });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
}

exports.connectDancer = async (req, res) => {
    try {
        const { dancerId } = req.body;
        if (isEmpty(dancerId)) return res.status(400).json({ success: false, message: "Invalid Request!" });

        let userId = req.user.id;
        let dancer = await User.findOne({ _id: dancerId });
        let user = await User.findOne({ _id: userId })
        if (isEmpty(dancer)) return res.status(404).json({ success: false, message: 'Profile not found' });

        if (dancer.pending.includes(userId)) return res.status(400).json({ success: false, message: "You already sent the connect request, please wait until accept" });
        if (dancer.connect.includes(userId)) return res.status(400).json({ success: false, message: "You already connected with that user" });

        if (!user.following.includes(dancerId)) {
            user.following.push(dancerId)
            await user.save();
        }

        if (!dancer.follower.includes(userId)) {
            dancer.follower.push(userId)
        }
        dancer.pending.push(userId);

        await dancer.save();

        return res.status(200).json({ success: true, message: "Successfully sent the connect request" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.acceptDancer = async (req, res) => {
    try {
        const { dancerId } = req.body;

        if (isEmpty(dancerId)) return res.status(400).json({ success: false, message: "Invalid Request!" });

        let userId = req.user.id;

        let dancer = await User.findOne({ _id: dancerId });
        let user = await User.findOne({ _id: userId })

        if (isEmpty(dancer)) return res.status(404).json({ success: false, message: 'Connect Requester not found' });
        if (!user.pending.includes(dancerId)) return res.status(400).json({ success: false, message: "Invalid Request!" });

        if (!user.following.includes(dancerId)) {
            user.following.push(dancerId)
        }

        if (!dancer.follower.includes(userId)) {
            dancer.follower.push(userId)
        }

        const index = user.pending.indexOf(dancerId);
        user.pending.splice(index, 1);

        user.connect.push(dancerId);
        dancer.connect.push(userId)

        await user.save();
        await dancer.save();

        return res.status(200).json({ success: true, message: "Successfully connected" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.followManage = async (req, res) => {
    try {
        const { dancerId } = req.body;

        if (isEmpty(dancerId)) return res.status(400).json({ success: false, message: "Invalid Request!" });

        let userId = req.user.id;

        let dancer = await User.findOne({ _id: dancerId });
        let user = await User.findOne({ _id: userId })

        if (isEmpty(dancer) || isEmpty(user)) return res.status(404).json({ success: false, message: 'User Not found' });

        if (user.following.includes(dancerId)) {
            const userIndex = user.following.indexOf(dancerId);
            user.following.splice(userIndex, 1);

            const dancerIndex = dancer.follower.indexOf(userId)
            dancer.follower.splice(dancerIndex, 1);
        } else {
            user.following.push(dancerId)
            dancer.follower.push(userId)
        }

        await user.save();
        await dancer.save();

        return res.status(200).json({ success: true, message: "success" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
