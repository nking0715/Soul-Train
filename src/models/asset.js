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
    category: {
        type: String,
        required: true
    },
    contentType: {
        type: String,
    },
    uploadedTime: {
        type: Date,
        default: Date.now()
    },
    blocked: {
        type: Boolean,
        default: false
    },
    // ... any other video-related fields
},
    { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
