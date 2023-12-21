const User = require('../models/user');
const Post = require('../models/post');
const isEmpty = require('../utils/isEmpty');
const { parseQueryParam } = require('../utils/queryUtils');

exports.search = async (req, res) => {
  try {
    const { page = 1, perPage = 10, searchText, category } = req.query;

    if (isEmpty(searchText) || isEmpty(category)) {
      return res.status(400).json({ success: false, message: "Invalid Request!" });
    }

    const pageConverted = parseQueryParam(page, 1);
    const perPageConverted = parseQueryParam(perPage, 10);
    const start = (pageConverted - 1) * perPageConverted; // Calculate the skip value

    const userId = req.user.id;

    const numberOfAccounts = await User.countDocuments({
      _id: { $ne: userId },
      $or: [
        { username: { $regex: searchText, $options: "i" } },
        { artistName: { $regex: searchText, $options: "i" } },
      ]
    });

    const numberOfPostsForTag = await Post.countDocuments({
      _id: { $ne: userId },
      tags: { $elemMatch: { $regex: searchText, $options: "i" } }
    })

    if (category == 'accounts') {
      const users = await User.find({
        _id: { $ne: userId },
        $or: [
          { username: { $regex: searchText, $options: "i" } },
          { artistName: { $regex: searchText, $options: "i" } },
        ]
      })
        .select("profilePicture username artistName numberOfFollowers follower") // Also fetch the followers field
        .skip(start)  // Skip the documents
        .limit(perPageConverted);  // Limit the number of documents

      // Add a "followed" boolean to each user based on whether the current user follows them
      const usersWithFollowStatus = users.map(user => {
        const followed = user.follower.includes(userId);
        const { follower, ...userDetails } = user._doc;
        return {
          ...userDetails, // Spread the existing user fields
          followed, // Add the "followed" status
        };
      });
      return res.status(200).json({
        success: true,
        searchResult: { accounts: usersWithFollowStatus },
        numberOfAccounts,
        numberOfPostsForTag
      });
    } else if (category == 'hashtags') {
      const posts = await Post.aggregate([
        {
          $match:
          {
            _id: { $ne: userId },
            tags: { $elemMatch: { $regex: searchText, $options: "i" } }
          }
        },
        { $sort: { createdAt: -1 } }, // Sort assets by uploadedTime in ascending order
        { $skip: start }, // Skip the specified number of documents
        { $limit: perPageConverted }, // Limit the number of documents
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
      return res.status(200).json({
        success: true,
        searchResult: { hashtags: posts },
        numberOfAccounts,
        numberOfPostsForTag
      });
    } else if (category == 'all') {
      const users = await User.find({
        _id: { $ne: userId },
        $or: [
          { username: { $regex: searchText, $options: "i" } },
          { artistName: { $regex: searchText, $options: "i" } },
        ]
      })
        .select("profilePicture username artistName numberOfFollowers follower") // Also fetch the followers field
        .skip(start)  // Skip the documents
        .limit(perPageConverted);  // Limit the number of documents

      // Add a "followed" boolean to each user based on whether the current user follows them
      const usersWithFollowStatus = users.map(user => {
        const followed = user.follower.includes(userId);
        const { follower, ...userDetails } = user._doc;
        return {
          ...userDetails, // Spread the existing user fields
          followed, // Add the "followed" status
        };
      });
      const posts = await Post.aggregate([
        {
          $match:
          {
            _id: { $ne: userId },
            tags: { $elemMatch: { $regex: searchText, $options: "i" } }
          }
        },
        { $sort: { createdAt: -1 } }, // Sort assets by uploadedTime in ascending order
        { $skip: start }, // Skip the specified number of documents
        { $limit: perPageConverted }, // Limit the number of documents
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
      return res.status(200).json({
        success: true,
        searchResult: {
          hashtags: posts,
          accounts: usersWithFollowStatus
        },
        numberOfAccounts,
        numberOfPostsForTag
      });
    }
  } catch (error) {
    console.log('Error in search: ', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}