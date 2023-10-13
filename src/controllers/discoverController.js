const isEmpty = require('../utils/isEmpty')
const Asset = require('../models/asset');
const User = require('../models/user')

exports.discoverContents = async (req, res) => {
    const { page, per_page } = req.body;
    const userId = req.user.id;
    if (isEmpty(page) || isEmpty(per_page)) {
        return res.status(400).json({ success: false, message: "Invalid Request!" });
    }
    const start = (page - 1) * per_page; // Calculate the skip value

    try {
        // Get the users that the requesting user follows
        const user = await User.findById(userId);
        const followedUserIds = user.following;

        const result = await Asset.aggregate([
            { $match: { blocked: false, type: "video", userId: { $nin: followedUserIds }  } },
            { $sort: { uploadedTime: 1 } }, // Sort assets by uploadedTime in ascending order
            { $skip: start }, // Skip the specified number of documents
            { $limit: per_page }, // Limit the number of documents
            {
                $lookup: {
                    from: "users", // Name of the user collection
                    localField: "userId",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    url: 1,
                    type: 1,
                    uploadedTime: 1,
                    numberOfViews: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    __v: 1,
                    username: { $arrayElemAt: ["$userDetails.username", 0] },
                    artistName: { $arrayElemAt: ["$userDetails.artistName", 0] },
                    profilePicture: { $arrayElemAt: ["$userDetails.profilePicture", 0] },
                }
            }
        ]);

        return res.status(200).json({ success: true, results: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.discoverBlockedContents = async (req, res) => {
    const { page, per_page } = req.body;
    if (isEmpty(page) || isEmpty(per_page)) {
        return res.status(400).json({ success: false, message: "Invalid Request!" });
    }
    const start = (page - 1) * per_page; // Calculate the skip value

    try {
        const result = await Asset.aggregate([
            { $match: { blocked: true } },
            { $sort: { uploadedTime: 1 } }, // Sort assets by uploadedTime in ascending order
            { $skip: start }, // Skip the specified number of documents
            { $limit: per_page }, // Limit the number of documents
            {
                $lookup: {
                    from: "users", // Name of the user collection
                    localField: "userId",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    url: 1,
                    type: 1,
                    uploadedTime: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    __v: 1,
                    username: { $arrayElemAt: ["$userDetails.username", 0] },
                    artistName: { $arrayElemAt: ["$userDetails.artistName", 0] }
                }
            }
        ]);

        return res.status(200).json({ success: true, results: result });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
