const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
    channelID: { type: String, required: true, unique: true },
    creatorID: { type: String, required: true },
    participantID: [{ type: String }],
});

module.exports = mongoose.model('Channel', channelSchema);