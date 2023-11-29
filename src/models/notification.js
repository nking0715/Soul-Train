const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    usersToRead: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    data: {
        type: { type: String },
        channelId: { type: String },
        channelName: { type: String }
    },
    notification: {
        title: { type: String },
        body: { type: String }
    }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
