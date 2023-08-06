const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    bio: {
        type: String,
        trim: true
    },
    dateOfBirth: Date,
    profilePicture: String,
    // ... other fields
});

module.exports = mongoose.model('Profile', profileSchema);
