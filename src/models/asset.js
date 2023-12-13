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
    },
    // ... any other video-related fields
},
    { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
