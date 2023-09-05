const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const waitListSchema = new mongoose.Schema({
    username: {
        type: String,
        trim: true,
        required: true
    },
    email: {
        type: String,
        trim: true,
        required: true,
        unique: true
    },
}, { timestamps: true });

module.exports = mongoose.model('Waitlist', waitListSchema);
