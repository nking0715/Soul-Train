const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportedPost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
    },
    reportedComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    reportContent: {
        type: String,
        default: ""
    },
    contentType: {
        type: String,
        default: ""
    },
    reportedTime: {
        type: Date,
        default: Date.now()
    },
},
    { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
