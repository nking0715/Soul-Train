const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    playerA: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    playerB: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    scoreA: {
        type: Number,
        default: 0
    },
    scoreB: {
        type: Number,
        default: 0
    },
    winner: {
        type: String
    },
    musicUrl: {
        type: String
    },
    videoUrl: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);