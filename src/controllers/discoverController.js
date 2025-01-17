const isEmpty = require('../utils/isEmpty');
const Asset = require('../models/asset');
const User = require('../models/user');

exports.discoverBlockedContents = async (req, res) => {
    const { page, perPage } = req.body;
    if (isEmpty(page) || isEmpty(perPage)) {
        return res.status(400).json({ success: false, message: "Invalid Request!" });
    }
    const start = (page - 1) * perPage; // Calculate the skip value

    try {
        const result = await Asset.aggregate([
            { $match: { blocked: true } },
            { $sort: { uploadedTime: 1 } }, // Sort assets by uploadedTime in ascending order
            { $skip: start }, // Skip the specified number of documents
            { $limit: perPage }, // Limit the number of documents
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
