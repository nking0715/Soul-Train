const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    userId: {
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
    thumbnail: {
        type: String
    },
    tags: {
        type: String,
        trim: true,
        default: ""
    },
    caption: {
        type: String,
        trim: true,
        default: ""
    },
    category: {
        type: String,
        default: ""
    },
    uploadedTime: {
        type: Date,
        default: Date.now()
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
    }]
},
    { timestamps: true });

module.exports = mongoose.model('Post', postSchema);
