const User = require('../models/user');
const Asset = require('../models/asset');
const Post = require('../models/post');
const Comment = require('../models/comment');
const Report = require('../models/report');
const isEmpty = require('../utils/isEmpty');
const { uploadFileToS3, uploadImageThumbnailToS3, uploadVideoThumbnailToS3 } = require('../utils/aws');
const { moderateContent } = require('../helper/moderation.helper')

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
                    const file_on_s3 = await uploadFileToS3(uploadedContent, fileExtension, bucketPath);
                    contentLink = file_on_s3.location;
                    rekognitionResult = await moderateContent(`${bucketPath}/${file_on_s3.newFileName}`, contentType);

                    const newAsset = new Asset({
                        userId: userId,
                        url: contentLink,
                        category: "post",
                        contentType: contentType,
                        blocked: rekognitionResult.success ? false : true
                    })
                    assets.push(newAsset);
                    await newAsset.save();
                    if (rekognitionResult.success == false) {
                        return res.status(400).json({ success: false, message: "The uploaded image or video contains inappropriate content" });
                    }
                } catch (error) {
                    console.log("upload content Error ", error)
                    return res.status(500).json({ success: false, message: error.message });
                }
            }

            if (assets[0].contentType == "image") {
                const promise = await uploadImageThumbnailToS3(assets[0].url, assets[0].id);
                let newPost = new Post({
                    userId: userId,
                    assets: assets,
                    thumbnail: promise.Location,
                    tags: tags,
                    caption: caption,
                });
                if (assets.length > 1) {
                    newPost.category = 'combination'
                } else {
                    newPost.category = 'singleImage'
                }
                await newPost.save();
            } else {
                const thumbnailUrl = await uploadVideoThumbnailToS3(assets[0].url, assets[0].id)
                let newPost = new Post({
                    userId: userId,
                    assets: assets,
                    thumbnail: thumbnailUrl,
                    tags: tags,
                    caption: caption,
                });
                if (assets.length > 1) {
                    newPost.category = 'combination'
                } else {
                    newPost.category = 'singleVideo'
                }
                await newPost.save();
            }
            const posts = await Post.find({
                userId: userId,
            })
                .sort({ uploadedTime: -1 }) // Sort by updated time, descending
                .limit(50)
                .select('_id thumbnail numberOfViews numberOfLikes numberOfComments likeList');
            return res.status(200).json({ success: true, first50Posts: posts });
        } else {
            return res.status(400).json({ success: false, message: "Invalid Request!" })
        }
    } catch (error) {
        console.log("upload content Error ", error)
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
        await post.save();

        res.status(200).json({ success: true, comment: newComment });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getComment = async (req, res) => {
    try {
        const { postId, page } = req.body;
        const perPage = 10;
        const skip = (page - 1) * perPage;
        const comments = await Comment.find({ post: postId })
            .skip(skip)
            .limit(perPage)
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
        await Comment.findByIdAndRemove(commentId);

        return res.status(200).json({ success: true, message: 'Comment was successfully deleted.' })
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
        const skip = (page - 1) * per_page;
        const posts = await Post.find({ saveList: userId })
            .skip(skip)
            .limit(per_page)
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, posts });
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