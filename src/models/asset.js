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
    uploadedTime: {
        type: Date,
        default: Date.now()
    }
    // ... any other video-related fields
},
    { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
