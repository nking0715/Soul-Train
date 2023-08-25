const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
    profile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Profile',
        required: true
    },
    url: {
        type: String,
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
});

module.exports = mongoose.model('Photo', photoSchema);
