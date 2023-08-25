const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    artistName: {
        type: String,
        trim: true,
    },
    hasChangedArtistName: {
        type: Boolean,
        default: false
    },
    profilePicture: String,
    coverPicture: String,
    videos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video'
    }],
    photos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Photo'
    }],
    bio: {
        type: String,
        trim: true
    },
    crew: {
        type: String,
        trim: true
    },
    homeLocation: {
        type: String,
        trim: true
    },
    // Private Information
    email: {
        type: String,
        trim: true,
        private: true
    },
    phoneNumber: {
        type: String,
        trim: true,
        private: true
    },
    // ... other existing fields
});

module.exports = mongoose.model('Profile', profileSchema);
