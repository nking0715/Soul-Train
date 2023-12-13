const User = require('../models/user');
const Asset = require('../models/asset');
const Post = require('../models/post');
const Comment = require('../models/comment');
const FcmToken = require('../models/fcmToken');
const Notification = require('../models/notification');
const Report = require('../models/report');
const isEmpty = require('../utils/isEmpty');
const { uploadFileToS3, uploadFileToS3Multipart, uploadImageThumbnailToS3, uploadVideoThumbnailToS3 } = require('../utils/aws');
const { moderateContent } = require('../helper/moderation.helper')
const dateFormat = require('date-and-time');
const { sendPushNotification } = require('../utils/notification');

const videoMimeToExt = {
    'video/mp4': '.mp4',
    'video/avi': '.avi',
    'video/x-msvideo': '.avi',
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

const MAX_IMAGE_SIZE = 10000000; // 10MB
const MAX_VIDEO_SIZE = 200000000; // 200MB
const BUCKET_PATH = "Post";
const FILE_MIME_TO_EXT = { ...imageMimeToExt, ...videoMimeToExt };

// Modularized functions
const processUploadedContent = async (uploadedContent, userId) => {
    const fileExtension = FILE_MIME_TO_EXT[uploadedContent.mimetype];
    if (!fileExtension) {
        throw new Error('Unsupported file type');
    }

    const contentType = uploadedContent.mimetype.startsWith('image') ? "image" : "video";
    const maxFileSizeBytes = contentType === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

    if (uploadedContent.size > maxFileSizeBytes) {
        throw new Error("File size exceeds limit.");
    }

    const keyPrefix = dateFormat.format(new Date(), "YYYYMMDDHHmmss");
    const newFileName = `${BUCKET_PATH}/${keyPrefix}${fileExtension}`;

    const fileOnS3 = await uploadFileToS3Multipart(uploadedContent, newFileName);
    const thumbnailUrl = await uploadThumbnailToS3(newFileName, keyPrefix, contentType);

    return { fileOnS3, thumbnailUrl, newFileName, contentType };
}

// Additional function for thumbnail uploading
const uploadThumbnailToS3 = async (fileName, keyPrefix, contentType) => {
    if (contentType === 'image') {
        return (await uploadImageThumbnailToS3(fileName, keyPrefix)).Location;
    } else if (contentType === 'video') {
        return await uploadVideoThumbnailToS3(fileName, keyPrefix);
    }
}

const fetchFirst50Posts = async (userId) => {
    return Post.aggregate([
        {
            $match: {
                $expr: {
                    $and: [
                        { $eq: [{ $toString: "$author" }, userId] },
                    ]
                }
            }
        },
        { $sort: { createdAt: -1 } },
        { $skip: 0 },
        { $limit: 50 },
        {
            $lookup: {
                from: "users", // Name of the user collection
                localField: "author",
                foreignField: "_id",
                as: "userDetails"
            }
        },
        {
            $lookup: {
                from: "assets", // Name of the assets collection
                localField: "assets",
                foreignField: "_id",
                as: "assetDetails"
            }
        },
        {
            $project: {
                _id: 1,
                thumbnail: 1,
                assets: {
                    $map: {
                        input: "$assetDetails",
                        as: "asset",
                        in: {
                            url: "$$asset.url",
                            thumbnail: "$$asset.thumbnail",
                            contentType: "$$asset.contentType"
                        }
                    }
                },
                numberOfViews: 1,
                numberOfLikes: 1,
                numberOfComments: 1,
                tags: 1,
                caption: 1,
                createdAt: 1,
                likeList: 1,
                saveList: 1,
                likedByUser: {
                    $cond: [
                        {
                            $and: [
                                { $isArray: "$likeList" },
                                { $in: [{ $toObjectId: userId }, "$likeList"] }
                            ]
                        },
                        true,
                        false
                    ]
                },
                savedByUser: {
                    $cond: [
                        {
                            $and: [
                                { $isArray: "$saveList" },
                                { $in: [{ $toObjectId: userId }, "$saveList"] }
                            ]
                        },
                        true,
                        false
                    ]
                },
                username: { $arrayElemAt: ["$userDetails.username", 0] },
                artistName: { $arrayElemAt: ["$userDetails.artistName", 0] },
                profilePicture: { $arrayElemAt: ["$userDetails.profilePicture", 0] },
            }
        },
        {
            $project: {
                likeList: 0,
                saveList: 0
            }
        }
    ]);
}

exports.createPost = async (req, res) => {
    try {
        console.time('processDuration');
        const userId = req.user.id;
        const { tags, caption } = req.body;
        const files = req.files;

        const user = await User.findOne({ _id: userId });
        if (isEmpty(user)) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (!files || Object.keys(files).length === 0) {
            return res.status(400).json({ success: false, message: "Invalid Request!" });
        }

        let assets = [];
        let fileNames = [];
        const uploadedContents = Array.isArray(files.files) ? files.files : [files.files];

        for (const uploadedContent of uploadedContents) {

            const { fileOnS3, thumbnailUrl, newFileName, contentType } = await processUploadedContent(uploadedContent, userId);


            const newAsset = new Asset({
                userId: userId,
                url: fileOnS3.location,
                thumbnail: thumbnailUrl,
                category: "post",
                contentType: contentType,
                // blocked: rekognitionResult.success ? false : true
            })
            await newAsset.save();
            assets.push(newAsset);
            fileNames.push(newFileName);

            /* if (rekognitionResult.success == false) {
                console.log(rekognitionResult.reason);
                return res.status(400).json({ success: false, message: "The uploaded image or video contains inappropriate content" });
            } */
        }

        const newPost = new Post({ author: userId, assets, tags, caption, });
        await newPost.save();

        res.status(200).json({ success: true, newPost });
        console.timeEnd('processDuration');
        // Start content moderation for all assets simultaneously using newFileNames
        const moderationResults = await Promise.all(
            fileNames.map((newFileName, index) =>
                moderateContent(newFileName, assets[index].contentType))
        );

        // Check if any content moderation failed
        let postBlocked = moderationResults.some(result => !result.success);

        // Update each asset with the moderation result
        moderationResults.forEach((result, index) => {
            Asset.findByIdAndUpdate(assets[index]._id, { blocked: !result.success }).exec();
        });

        if (postBlocked) {
            // Update the post's blocked status if any moderation failed
            await Post.findByIdAndUpdate(newPost._id, { blocked: true });
            const fcmToken = await FcmToken.findOne({ userId: userId });
            if (!isEmpty(fcmToken)) {
                const data = {
                    type: 'Post Flagged',
                    postId: newPost._id.toString()
                }
                const notification = {
                    title: 'The post was flagged as inappropriate.',
                    body: `Your post was rejected due to inappropriate content.`
                }
                const newNotification = new Notification({
                    usersToRead: [userId],
                    data: data,
                    notification: notification
                });
                data.notificationId = newNotification._id.toString();
                const sendNotificationResult = await sendPushNotification([fcmToken.token], data, notification);
                if (!sendNotificationResult) {
                    return res.status(500).json({ success: false, message: 'Notification was not sent.' });
                }
                await newNotification.save();
            }
        } else {
            await Post.findByIdAndUpdate(newPost._id, { blocked: false });
        }

    } catch (error) {
        console.log("upload content Error ", error)
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getPost = async (req, res) => {
    try {
        const { page, per_page, userId } = req.query;
        const userToSearch = userId || req.user.id;
        if (isEmpty(page) || isEmpty(per_page)) {
            return res.status(400).json({ success: false, message: "Invalid Request!" });
        }
        const pageConverted = parseInt(page, 10);
        const per_pageConverted = parseInt(per_page, 10);
        const skip = (pageConverted - 1) * per_pageConverted; // Calculate the skip value

        const posts = await Post.aggregate([
            {
                $match: {
                    $expr: {
                        $and: [
                            { $eq: [{ $toString: "$author" }, userToSearch] },
                            { $ne: ["$blocked", true] }
                        ]
                    }
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: per_pageConverted },
            {
                $lookup: {
                    from: "users", // Name of the user collection
                    localField: "author",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $lookup: {
                    from: "assets", // Name of the assets collection
                    localField: "assets",
                    foreignField: "_id",
                    as: "assetDetails"
                }
            },
            {
                $project: {
                    _id: 1,
                    thumbnail: 1,
                    assets: {
                        $map: {
                            input: "$assetDetails",
                            as: "asset",
                            in: {
                                url: "$$asset.url",
                                thumbnail: "$$asset.thumbnail",
                                contentType: "$$asset.contentType"
                            }
                        }
                    },
                    numberOfViews: 1,
                    numberOfLikes: 1,
                    numberOfComments: 1,
                    tags: 1,
                    caption: 1,
                    createdAt: 1,
                    likeList: 1,
                    saveList: 1,
                    likedByUser: {
                        $cond: [
                            {
                                $and: [
                                    { $isArray: "$likeList" },
                                    { $in: [{ $toObjectId: userId }, "$likeList"] }
                                ]
                            },
                            true,
                            false
                        ]
                    },
                    savedByUser: {
                        $cond: [
                            {
                                $and: [
                                    { $isArray: "$saveList" },
                                    { $in: [{ $toObjectId: userId }, "$saveList"] }
                                ]
                            },
                            true,
                            false
                        ]
                    },
                    user_id: { $arrayElemAt: ["$userDetails._id", 0] },
                    username: { $arrayElemAt: ["$userDetails.username", 0] },
                    artistName: { $arrayElemAt: ["$userDetails.artistName", 0] },
                    profilePicture: { $arrayElemAt: ["$userDetails.profilePicture", 0] },
                }
            },
            {
                $project: {
                    likeList: 0,
                    saveList: 0
                }
            }
        ]);
        return res.status(200).json({ success: true, posts: posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const postId = req.query.postId;
        const userId = req.user.id;
        const post = await Post.findById(postId)
            .select("author");
        if (userId !== post.author.toString()) {
            return res.status(403).json({ success: false, message: "The user can't delete a post created by another user." });
        }
        if (isEmpty(post)) {
            return res.status(400).json({ success: false, message: "Post not found." });
        }
        await Post.findByIdAndRemove(postId);
        return res.status(200).json({ success: true, message: "Post successfully removed." });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.commentPost = async (req, res) => {
    try {
        const { content, postId } = req.body;
        const userId = req.user.id;
        if (isEmpty(content) || isEmpty(postId)) {
            return res.status(400).json({ success: false, message: "Bad request" });
        }
        const newComment = new Comment({
            content: content,
            post: postId,
            author: userId
        });

        await newComment.save();
        const post = await Post.findById(postId);
        if (isEmpty(post)) {
            return res.status(400).json({ success: false, message: "Post not found" });
        }
        post.comments.push(newComment);
        post.numberOfComments += 1;
        await post.save();

        res.status(200).json({ success: true, comment: newComment });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getComment = async (req, res) => {
    try {
        const { postId, page, per_page } = req.query;
        const skip = (page - 1) * per_page;
        const comments = await Comment.find({ post: postId })
            .skip(skip)
            .limit(per_page)
            .populate('author', 'username profilePicture')
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            comments,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.editComment = async (req, res) => {
    try {
        const { commentId, content } = req.body;
        const userId = req.user.id;
        const comment = await Comment.findById(commentId);
        if (isEmpty(comment)) {
            return res.status(400).json({ success: false, message: 'Comment not found.' });
        }
        if (userId !== comment.author.toString()) {
            return res.status(403).json({ success: false, message: 'Attempt failed.' });
        }
        comment.content = content;
        await comment.save();
        return res.status(200).json({ success: true, comment });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.deleteComment = async (req, res) => {
    try {
        const commentId = req.query.commentId;
        const userId = req.user.id;
        const comment = await Comment.findById(commentId);
        if (isEmpty(comment)) {
            return res.status(400).json({ success: false, message: 'Comment not found.' });
        }
        if (userId !== comment.author.toString()) {
            return res.status(403).json({ success: false, message: 'Attempt failed.' });
        }

        await Post.findByIdAndUpdate(
            comment.post,
            {
                $pull: { comments: commentId },
                $inc: { numberOfComments: -1 }
            },
            { new: true }
        );

        await Comment.findByIdAndRemove(commentId);

        return res.status(200).json({ success: true, message: 'Comment was successfully deleted.' })
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.likeComment = async (req, res) => {
    try {
        const commentId = req.query.commentId;
        const userId = req.user.id;
        const comment = await Comment.findOne({ _id: commentId });
        if (isEmpty(comment)) {
            return res.status(400).json({ success: false, message: "The comment to be liked or unliked does not exist." })
        }
        /* if (userId == comment.author.toString()) {
            return res.status(403).json({ success: false, message: 'Attempt failed.' });
        } */
        if (comment.likeList.includes(userId)) {
            // If userId exists in the likeList array, remove it
            comment.likeList.pull(userId);

            // Decrease the numberOfLikes by 1
            comment.numberOfLikes -= 1;
        } else {
            // If userId does not exist in the likeList array, add it
            comment.likeList.push(userId);

            // Increase the numberOfLikes by 1
            comment.numberOfLikes += 1;
        }
        await comment.save();
        return res.status(200).json({
            success: true,
            message: `UserId ${comment.likeList.includes(userId) ? 'added to' : 'removed from'} the likeList.`,
            numberOfLikes: comment.numberOfLikes,
            likeContent: comment.likeList.includes(userId)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.savePost = async (req, res) => {
    try {
        const postId = req.body.postId;
        const userId = req.user.id;
        const post = await Post.findById(postId);
        if (isEmpty(post)) {
            return res.status(400).json({ success: false, message: 'Post not found.' });
        }

        if (!isEmpty(post.saveList) && post.saveList.includes(userId)) {
            post.saveList.pull(userId);
            await post.save();
            return res.status(200).json({ success: true, message: 'Post was removed from saved content.' });
        }
        post.saveList.push(userId);
        await post.save();
        return res.status(200).json({ success: true, message: 'Post was saved.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getSavedPost = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page, per_page } = req.query;
        if (isEmpty(page) || isEmpty(per_page)) {
            return res.status(400).json({ success: false, message: "Invalid Request!" });
        }
        const pageConverted = parseInt(page, 10);
        const per_pageConverted = parseInt(per_page, 10);
        const skip = (pageConverted - 1) * per_pageConverted;
        const result = await Post.aggregate([
            {
                $match:
                {
                    $expr: {
                        $and: [
                            { $in: [{ $toObjectId: userId }, "$saveList"] },
                            { $ne: ["$blocked", true] }
                        ]
                    }
                }
            },
            { $sort: { createdAt: -1 } }, // Sort assets by uploadedTime in ascending order
            { $skip: skip }, // Skip the specified number of documents
            { $limit: per_pageConverted }, // Limit the number of documents
            {
                $lookup: {
                    from: "users", // Name of the user collection
                    localField: "author",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $lookup: {
                    from: "assets", // Name of the assets collection
                    localField: "assets",
                    foreignField: "_id",
                    as: "assetDetails"
                }
            },
            {
                $project: {
                    _id: 1,
                    thumbnail: 1,
                    assets: {
                        $map: {
                            input: "$assetDetails",
                            as: "asset",
                            in: {
                                url: "$$asset.url",
                                thumbnail: "$$asset.thumbnail",
                                contentType: "$$asset.contentType"
                            }
                        }
                    },
                    numberOfViews: 1,
                    numberOfLikes: 1,
                    numberOfComments: 1,
                    tags: 1,
                    caption: 1,
                    createdAt: 1,
                    likeList: 1,
                    likedByUser: {
                        $cond: [
                            {
                                $and: [
                                    { $isArray: "$likeList" },
                                    { $in: [{ $toObjectId: userId }, "$likeList"] }
                                ]
                            },
                            true,
                            false
                        ]
                    },
                    user_id: { $arrayElemAt: ["$userDetails._id", 0] },
                    username: { $arrayElemAt: ["$userDetails.username", 0] },
                    artistName: { $arrayElemAt: ["$userDetails.artistName", 0] },
                    profilePicture: { $arrayElemAt: ["$userDetails.profilePicture", 0] },
                }
            },
            {
                $project: {
                    likeList: 0,
                }
            }
        ]);

        return res.status(200).json({ success: true, results: result });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.reportContent = async (req, res) => {
    try {
        const { postId, commentId, content } = req.body;
        const userId = req.user.id;
        if (postId) {
            const post = await Post.findById(postId);
            if (isEmpty(post)) {
                return res.status(400).json({ success: false, message: 'Post not found' });
            }
            const newReport = new Report({
                reporter: userId,
                reportedPost: postId,
                reportContent: content,
                contentType: "Post"
            });
            await newReport.save();
            return res.status(200).json({ success: true, message: 'Post successfully reported.' });
        } else if (commentId) {
            const comment = await Comment.findById(commentId);
            if (isEmpty(comment)) {
                return res.status(400).json({ success: false, message: 'Comment not found' });
            }
            const newReport = new Report({
                reporter: userId,
                reportedComment: commentId,
                reportContent: content,
                contentType: "Comment"
            });
            await newReport.save();
            return res.status(200).json({ success: true, message: 'Comment successfully reported.' });
        } else {
            return res.status(400).json({ success: false, message: 'Bad Request' });
        }
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.discoverPosts = async (req, res) => {
    const { page, per_page } = req.query;
    const userId = req.user.id;
    if (isEmpty(page) || isEmpty(per_page)) {
        return res.status(400).json({ success: false, message: "Invalid Request!" });
    }
    const pageConverted = parseInt(page, 10);
    const per_pageConverted = parseInt(per_page, 10);
    const start = (pageConverted - 1) * per_pageConverted; // Calculate the skip value

    try {
        // Get the users that the requesting user follows
        const user = await User.findById(userId);
        const followedUserIds = user.following;

        const result = await Post.aggregate([
            {
                $lookup: {
                    from: "assets", // Join with the assets collection first to filter posts with video assets
                    localField: "assets",
                    foreignField: "_id",
                    as: "assetDetails"
                }
            },
            {
                $match: {
                    'assetDetails.contentType': 'video', // Match posts with at least one asset of type video
                    author: { $nin: followedUserIds }, // Original author filtering logic         
                    blocked: { $ne: true }
                }
            },
            { $sort: { createdAt: -1 } }, // Sort assets by uploadedTime in ascending order
            { $skip: start }, // Skip the specified number of documents
            { $limit: per_pageConverted }, // Limit the number of documents
            {
                $lookup: {
                    from: "users", // Name of the user collection
                    localField: "author",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $project: {
                    _id: 1,
                    thumbnail: 1,
                    assets: {
                        $map: {
                            input: {
                                $filter: {
                                    input: "$assetDetails",
                                    as: "asset",
                                    cond: { $eq: ["$$asset.contentType", "video"] } // Again, ensure we're only mapping video assets
                                }
                            },
                            as: "asset",
                            in: {
                                url: "$$asset.url",
                                thumbnail: "$$asset.thumbnail"
                            }
                        }
                    },
                    numberOfViews: 1,
                    numberOfLikes: 1,
                    numberOfComments: 1,
                    tags: 1,
                    caption: 1,
                    createdAt: 1,
                    likeList: 1,
                    saveList: 1,
                    likedByUser: {
                        $cond: [
                            {
                                $and: [
                                    { $isArray: "$likeList" },
                                    { $in: [{ $toObjectId: userId }, "$likeList"] }
                                ]
                            },
                            true,
                            false
                        ]
                    },
                    savedByUser: {
                        $cond: [
                            {
                                $and: [
                                    { $isArray: "$saveList" },
                                    { $in: [{ $toObjectId: userId }, "$saveList"] }
                                ]
                            },
                            true,
                            false
                        ]
                    },
                    user_id: { $arrayElemAt: ["$userDetails._id", 0] },
                    username: { $arrayElemAt: ["$userDetails.username", 0] },
                    artistName: { $arrayElemAt: ["$userDetails.artistName", 0] },
                    profilePicture: { $arrayElemAt: ["$userDetails.profilePicture", 0] },
                    assets: {
                        $map: {
                            input: {
                                $filter: {
                                    input: "$assetDetails",
                                    as: "asset",
                                    cond: { $eq: ["$$asset.contentType", "video"] } // Again, ensure we're only mapping video assets
                                }
                            },
                            as: "asset",
                            in: {
                                url: "$$asset.url",
                                thumbnail: "$$asset.thumbnail"
                            }
                        }
                    },
                }
            },
            {
                $project: {
                    likeList: 0,
                    saveList: 0
                }
            }
        ]);

        return res.status(200).json({ success: true, results: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.homeFeed = async (req, res) => {
    const { page, per_page } = req.query;
    const userId = req.user.id;
    if (isEmpty(page) || isEmpty(per_page)) {
        return res.status(400).json({ success: false, message: "Invalid Request!" });
    }
    const pageConverted = parseInt(page, 10);
    const per_pageConverted = parseInt(per_page, 10);
    const start = (pageConverted - 1) * per_pageConverted; // Calculate the skip value

    try {
        // Get the users that the requesting user follows
        const user = await User.findById(userId);
        const followedUserIds = user.following;

        const result = await Post.aggregate([
            { $match: { author: { $in: followedUserIds }, blocked: { $ne: true } } },
            { $sort: { createdAt: -1 } }, // Sort assets by uploadedTime in ascending order
            { $skip: start }, // Skip the specified number of documents
            { $limit: per_pageConverted }, // Limit the number of documents
            {
                $lookup: {
                    from: "users", // Name of the user collection
                    localField: "author",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $lookup: {
                    from: "assets", // Name of the assets collection
                    localField: "assets",
                    foreignField: "_id",
                    as: "assetDetails"
                }
            },
            {
                $project: {
                    _id: 1,
                    thumbnail: 1,
                    assets: {
                        $map: {
                            input: "$assetDetails",
                            as: "asset",
                            in: {
                                url: "$$asset.url",
                                thumbnail: "$$asset.thumbnail",
                                contentType: "$$asset.contentType"
                            }
                        }
                    },
                    numberOfViews: 1,
                    numberOfLikes: 1,
                    numberOfComments: 1,
                    tags: 1,
                    caption: 1,
                    createdAt: 1,
                    likeList: 1,
                    saveList: 1,
                    likedByUser: {
                        $cond: [
                            {
                                $and: [
                                    { $isArray: "$likeList" },
                                    { $in: [{ $toObjectId: userId }, "$likeList"] }
                                ]
                            },
                            true,
                            false
                        ]
                    },
                    savedByUser: {
                        $cond: [
                            {
                                $and: [
                                    { $isArray: "$saveList" },
                                    { $in: [{ $toObjectId: userId }, "$saveList"] }
                                ]
                            },
                            true,
                            false
                        ]
                    },
                    user_id: { $arrayElemAt: ["$userDetails._id", 0] },
                    username: { $arrayElemAt: ["$userDetails.username", 0] },
                    artistName: { $arrayElemAt: ["$userDetails.artistName", 0] },
                    profilePicture: { $arrayElemAt: ["$userDetails.profilePicture", 0] },
                }
            },
            {
                $project: {
                    likeList: 0,
                    saveList: 0
                }
            }
        ]);

        return res.status(200).json({ success: true, results: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.likePost = async (req, res) => {
    try {
        const postId = req.query.postId;
        const userId = req.user.id;
        const post = await Post.findOne({ _id: postId });
        if (isEmpty(post)) {
            return res.status(400).json({ success: false, message: "The post to be liked or unliked does not exist." })
        }
        /* if (userId == post.author.toString()) {
            return res.status(403).json({ success: false, message: 'Attempt failed.' });
        } */
        if (post.likeList.includes(userId)) {
            // If userId exists in the likeList array, remove it
            post.likeList.pull(userId);

            // Decrease the numberOfLikes by 1
            post.numberOfLikes -= 1;
        } else {
            // If userId does not exist in the likeList array, add it
            post.likeList.push(userId);

            // Increase the numberOfLikes by 1
            post.numberOfLikes += 1;
        }
        await post.save();
        return res.status(200).json({
            success: true,
            message: `UserId ${post.likeList.includes(userId) ? 'added to' : 'removed from'} the likeList.`,
            numberOfLikes: post.numberOfLikes,
            likeContent: post.likeList.includes(userId)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}