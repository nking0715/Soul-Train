const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    aboutMe: {
        type: String,
        trim: true
    },
    dateOfBirth: Date,
    profilePicture: String,
    country: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
    // ... other fields
});

module.exports = mongoose.model('Profile', profileSchema);
