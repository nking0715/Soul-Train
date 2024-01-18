const Match = require('../models/match');
const User = require('../models/user');
require('dotenv').config();

exports.getMatchListByUserId = async (req, res) => {
    try {
        let { userId } = req.query;
        const matchs = await Match.find({ users: { $in: [userId] } }).populate('users', 'username artistName'); // Only include username and artistName

        return res.status(200).json({
            success: true,
            matchs,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getMatchListWithFriends = async (req, res) => {
    try {
        let { userId , perPage = 5, page = 1 } = req.query;

        // Calculate the number of results to skip (for pagination)
        const skip = (page - 1) * perPage;
        // Calculate the date 48 hours ago from now
        const date48HoursAgo = new Date(new Date().getTime() - (48 * 60 * 60 * 1000));

        // Retrieve the user and their friends list
        const user = await User.findById(userId).populate('follower');
        if (!user) {
            console.log('User not found');
            return;
        }

        // Extract friend IDs from the followers
        const friendIds = user.follower.map(friend => friend._id);

        // Find matches where any of the friends are involved
        const matches = await Match.find({ 
            users: { $in: friendIds },
            createdAt: { $gte: date48HoursAgo } // Filter to include only matches created within the last 48 hours
        }).sort({ createdAt: -1 }) // Sorting by createdAt in descending order (newest first)
        .skip(skip)              // Skip the previous pages' results
        .limit(perPage)          // Limit the number of results
        .populate('users', 'username artistName'); // Only include username and artistName

        // Check if matches were found
        if (matches.length > 0) {
            console.log('Matches found with friends:', matches);
        } else {
            console.log('No matches found with friends');
        }

        return res.status(200).json({
            success: true,
            matches,
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }

}

exports.getMatchListByDiscovery = async (req, res) => {
    try {
        let { userId, perPage = 5, page = 1 } = req.query;
        const skip = (page - 1) * perPage;
        const matches = await Match.find({ 
            users: { $in: [userId] },
            createdAt: { $gte: date48HoursAgo } // Filter to include only matches created within the last 48 hours
        }).sort({ createdAt: -1 }) // Sorting by createdAt in descending order (newest first)
        .skip(skip)              // Skip the previous pages' results
        .limit(perPage)          // Limit the number of results
        .populate('users', 'username artistName'); // Only include username and artistName
        return res.status(200).json({
            success: true,
            matches,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}