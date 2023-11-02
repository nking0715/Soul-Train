const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    url: {
        type: String,
        required: true
    },
    thumnail: {
        type: String,
    },
    type: {
        type: String,
        required: true
    },
    uploadedTime: {
        type: Date,
        default: Date.now()
    },
    blocked: {
        type: Boolean,
        default: false
    },
    caption: {
        type: String
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
    }]
    // ... any other video-related fields
},
    { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
