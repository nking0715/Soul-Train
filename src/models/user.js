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
    email: {
        type: String,
        unique: true
    },
    password: {
        type: String,
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
    facebookID: {
        type: String
    }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
