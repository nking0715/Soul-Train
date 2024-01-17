const mongoose = require('mongoose');

const kickedchannelSchema = new mongoose.Schema({
    contentUrl: { type: String },
    status: { type: String },
    userId: { type: String },
    addedAt: { type: String },
    contentId: { type: String },
    reason: { type: String },
    channelName: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('KickedChannel', kickedchannelSchema);