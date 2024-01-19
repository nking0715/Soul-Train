const Match = require('../models/match');
const User = require('../models/user');
const { getSignedUrl } = require('../helper/aws.helper');

require('dotenv').config();

async function updateSignedURL(match) {
    let videoUrl = match.videoUrl.split('.com/')[1];
    const signedVideoUrl = await getSignedUrl(videoUrl);
    let newMatch = match;
    newMatch.videoUrl = signedVideoUrl
    // Your async operation here, e.g., fetching data or processing
    return newMatch; // Return the result of the async operation
}

let isUserIdInArray = (userIds, checkId) => {
    userIds.some(userId =>
        userId.toString() === checkId.toString()
    );
}

async function processMatches(matches) {
    try {
        // Create an array of promises
        const promises = matches.map(match => updateSignedURL(match));

        // Await all promises
        const results = await Promise.all(promises);
        // 'results' is an array containing the outcome of each async operation
        return results;
    } catch (error) {
        // console.error('An error occurred:', error);
        throw error;
    }
}


exports.getMatchListByUserId = async (req, res) => {
    try {
        let { userId } = req.query;
        let match = await Match.find({ users: { $in: [userId] } }).populate('users', 'username artistName'); // Only include username and artistName        
        if (match.length) {
            let videoUrl = match[0]?.videoUrl.split('.com/')[1];
            videoUrl = await getSignedUrl(videoUrl);
            match[0].videoUrl = videoUrl;
        }
        return res.status(200).json({
            success: true,
            match,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

exports.getMatchListWithFriends = async (req, res) => {
    try {
        let { userId, perPage = 5, page = 1 } = req.query;
        // Calculate the number of results to skip (for pagination)
        const skip = (page - 1) * perPage;
        // Calculate the date 48 hours ago from now
        const date48HoursAgo = new Date(new Date().getTime() - (48 * 60 * 60 * 1000));

        // Retrieve the user and their friends list
        const user = await User.findById(userId).populate('follower');
        if (!user) {
            // console.log('User not found');
            return;
        }

        // Extract friend IDs from the followers
        const friendIds = user.follower.map(friend => friend._id);
        let data = [];
        // Find matches where any of the friends are involved
        let matches = await Match.find({
            users: { $in: friendIds },
            createdAt: { $gte: date48HoursAgo } // Filter to include only matches created within the last 48 hours
        }).sort({ createdAt: -1 }) // Sorting by createdAt in descending order (newest first)
            .skip(skip)              // Skip the previous pages' results
            .limit(perPage)          // Limit the number of results
            .populate('users', 'username artistName'); // Only include username and artistName
        if(matches.length) {
            matches = await processMatches(matches);
        }

        matches?.map(match => {
            let newMatch = match;
            if (isUserIdInArray(friendIds, match.playerA)) {
                newMatch.follower = match.playerA;
            }
            if (isUserIdInArray(friendIds, match.playerB)) {
                newMatch.follower = match.playerB;
            }
            // newMatch.
            data.push(newMatch);
        });

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
        // Calculate the date 48 hours ago from now
        const date48HoursAgo = new Date(new Date().getTime() - (48 * 60 * 60 * 1000));
        const skip = (page - 1) * perPage;
        let matches = await Match.find({
            createdAt: { $gte: date48HoursAgo } // Filter to include only matches created within the last 48 hours
        }).sort({ createdAt: -1 }) // Sorting by createdAt in descending order (newest first)
            .skip(skip)              // Skip the previous pages' results
            .limit(perPage)          // Limit the number of results
            .populate('users', 'username artistName'); // Only include username and artistName
        if(matches.length) {
            matches = await processMatches(matches);
        }
        return res.status(200).json({
            success: true,
            matches,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}