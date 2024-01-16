const Match = require('../models/match');
require('dotenv').config();

exports.getMatchListByUserId = async (req, res) => {
    try {
        let { userId } = req.query;
        const matchs = await Match.find({ users: { $in: [userId] } });
        return res.status(200).json({
            success: true,
            matchs,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}