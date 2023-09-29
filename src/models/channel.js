const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    channelType: { type: String, required: true },
    audienceType: { type: String, required: true },
    channelName: { type: String, required: true },
    uid: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Channel', channelSchema);