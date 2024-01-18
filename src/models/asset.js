const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    url: {
        type: String,
        required: true
    },    
    thumbnail: {
        type: String
    },
    category: {
        type: String,
        required: true
    },
    contentType: {
        type: String,
    },
    blocked: {
        type: Boolean,
        default: true
    },
    // ... any other video-related fields
},
    { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
