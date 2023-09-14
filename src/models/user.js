const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
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
    email: {
        type: String,
        trim: true,
        private: true,
        unique: true
    },
    password: {
        type: String,
    },
    resetToken: {
        type: String
    },
    resetPassExpiry: {
        type: Date,
    },
    validationCode: {
        type: String,
    },
    codeExpiry: {
        type: Date,
    },
    emailVerified: {
        type: Boolean,
        default: false
    },

    // Profile
    profilePicture: {
        type: String,
    },
    coverPicture: {
        type: String,
    },
    bio: {
        type: String,
        trim: true
    },
    crew: {
        type: String,
        trim: true
    },
    style: {
        type: String,
    },
    homeLocation: {
        type: String,
        trim: true
    },
    // Private Information
    phoneNumber: {
        type: String,
        trim: true,
        private: true
    },
    follower: {
        type: Array,
        default: []
    },
    following: {
        type: Array,
        default: []
    },
    pending: {
        type: Array,
        default: []
    },
    connect: {
        type: Array,
        default: []
    },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
