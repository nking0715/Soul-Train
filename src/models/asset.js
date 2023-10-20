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
    type: {
        type: String,
        trim: true,
        required: true
    },
    tags: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    purpose: {
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
    caption: {
        type: String
    },
    isLike: {
        type: Boolean,
        default: false
    }
    // ... any other video-related fields
},
    { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
