const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    usersToRead: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    data: mongoose.Schema.Types.Mixed,
    notification: {
        title: { type: String },
        body: { type: String }
    }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
