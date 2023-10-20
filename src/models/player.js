const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    playerInLobby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    entranceTime: {
        type: Date,
    }
})

module.exports = mongoose.model('Player', playerSchema);