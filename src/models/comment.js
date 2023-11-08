const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model for the author of the comment
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    numberOfLikes: {
        type: Number,
        default: 0
    },    
    likeList: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }]
});

module.exports = mongoose.model('Comment', commentSchema);