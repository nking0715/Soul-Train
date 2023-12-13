const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset',
        required: true
    }],
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }],
    tags: [{
        type: String,
        trim: true,
        default: ""
    }],
    caption: {
        type: String,
        trim: true,
        default: ""
    },
    numberOfViews: {
        type: Number,
        default: 0
    },
    numberOfLikes: {
        type: Number,
        default: 0
    },
    numberOfComments: {
        type: Number,
        default: 0
    },    
    likeList: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    saveList: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    blocked: {
        type: Boolean,
    }
},
    { timestamps: true });

module.exports = mongoose.model('Post', postSchema);
