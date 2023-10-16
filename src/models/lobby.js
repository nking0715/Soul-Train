const mongoose = require('mongoose');

const lobbySchema = new mongoose.Schema({
    queue: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    entranceTime: {
        type: Date,
    }
})

module.exports = mongoose.model('Lobby', lobbySchema);