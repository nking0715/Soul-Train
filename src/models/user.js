const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { toString } = require('express-validator/src/utils');

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
    resetCodeValidated: {
        type: Boolean,
        default: false
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
    profilePicture: {
        type: String,
        default: ""
    },
    coverPicture: {
        type: String,
        default: ""
    },
    bio: {
        type: String,
        trim: true,
        default: ""
    },
    crew: {
        type: String,
        trim: true
    },
    style: {
        type: String,
    },
    // Private Information
    phoneNumber: {
        type: String,
        trim: true,
        private: true
    },
    follower: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    numberOfFollowers: {
        type: Number,
        default: 0
    },
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    numberOfFollowings: {
        type: Number,
        default: 0
    },
    pending: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    connect: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    pushNotificationTokens: [{
        type: String,
    }]
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (this.follower || this.following) {
        this.numberOfFollowers = this.follower.length;
        this.numberOfFollowings = this.following.length;
    }
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('User', userSchema);
