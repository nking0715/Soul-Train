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
        type: String
    },
    coverPicture: {
        type: String
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
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    pending: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    connect: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
