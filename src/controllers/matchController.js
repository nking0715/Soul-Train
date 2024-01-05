const Match = require('../models/match');
require('dotenv').config();

exports.getMatchList = async (req, res) => {
  try {
      // const { postId, page = 1, perPage = 10 } = req.query;
      const matchs = await Match.findAll();
      return res.status(200).json({
          success: true,
          matchs,
      });
  } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
  }
}
