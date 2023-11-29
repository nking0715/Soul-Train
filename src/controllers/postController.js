const User = require('../models/user');
const Asset = require('../models/asset');
const Post = require('../models/post');
const Comment = require('../models/comment');
const Report = require('../models/report');
const isEmpty = require('../utils/isEmpty');
const { uploadFileToS3, uploadImageThumbnailToS3, uploadVideoThumbnailToS3 } = require('../utils/aws');
const { moderateContent } = require('../helper/moderation.helper')
const dateFormat = require('date-and-time');

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

exports.createPost = async (req, res) => {
    try {
        let contentLink, rekognitionResult = '';
        const bucketPath = "Post";
        const files = req.files;
        const userId = req.user.id;
        const { tags, caption } = req.body;
        const user = await User.findOne({ _id: userId });

        if (isEmpty(user)) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (files && Object.keys(files).length > 0) {
            let uploadedContents = [];
            let assets = [];
            if (Array.isArray(files.files)) {
                // If it's already an array, spread it.
                uploadedContents.push(...files.files);
            } else if (files.files !== undefined && files.files !== null) {
                // If it's not an array but is a single item, push the single item.
                uploadedContents.push(files.files);
            }
            for (let i = 0; i < uploadedContents.length; i++) {
                const uploadedContent = uploadedContents[i];
                try {
                    // Get file extension
                    const contentMimeToExt = { ...imageMimeToExt, ...videoMimeToExt };
                    const fileExtension = contentMimeToExt[uploadedContent.mimetype];
                    let maxFileSizeBytes, contentType = '';

                    // Check if the file type is supported
                    if (!fileExtension) {
                        return res.status(400).json({ success: false, message: 'Unsupported file type' });
                    }
                    if (uploadedContent.mimetype.startsWith('image')) {
                        contentType = "image";
                        maxFileSizeBytes = 10000000;
                    } else {
                        contentType = "video";
                        maxFileSizeBytes = 200000000;
                    }
                    if (uploadedContent.size > maxFileSizeBytes) {
                        return res.status(400).json({ success: false, message: "File size exceeds limit." });
                    }
                    const key_prefix = dateFormat.format(new Date(), "YYYYMMDDHHmmss");
                    const newFileName = key_prefix + fileExtension;
                    const file_on_s3 = await uploadFileToS3(uploadedContent, newFileName, bucketPath);
                    contentLink = file_on_s3.location;
                    console.log(contentType);
                    rekognitionResult = await moderateContent(`${bucketPath}/${file_on_s3.newFileName}`, contentType);
                    let thumbnailurl = '';
                    if (contentType == 'image') {
                        thumbnailurl = (await uploadImageThumbnailToS3(contentLink, key_prefix)).Location;
                    } else if (contentType == 'video') {
                        thumbnailurl = await uploadVideoThumbnailToS3(contentLink, key_prefix);
                    }
                    const newAsset = new Asset({
                        userId: userId,
                        url: contentLink,
                        thumbnail: thumbnailurl,
                        category: "post",
                        contentType: contentType,
                        blocked: rekognitionResult.success ? false : true
                    })
                    assets.push(newAsset);
                    await newAsset.save();
                    if (rekognitionResult.success == false) {
                        console.log(rekognitionResult.reason);
                        return res.status(400).json({ success: false, message: "The uploaded image or video contains inappropriate content" });
                    }
                } catch (error) {
                    console.log("upload content Error ", error)
                    return res.status(500).json({ success: false, message: error.message });
                }
            }

            const newPost = new Post({
                author: userId,
                assets: assets,
                tags: tags,
                caption: caption,
            });

            await newPost.save();
            const posts = await Post.aggregate([
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
            return res.status(200).json({ success: true, first50Posts: posts });
        } else {
            return res.status(400).json({ success: false, message: "Invalid Request!" })
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
                        $in: [{ $toObjectId: userId }, "$saveList"]
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
                    author: { $nin: followedUserIds } // Original author filtering logic
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
            { $match: { author: { $in: followedUserIds } } },
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