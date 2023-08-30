const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
    channelID: { type: String, required: true, unique: true },
    creatorID: { type: String, required: true },
    participantID: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Channel', channelSchema);