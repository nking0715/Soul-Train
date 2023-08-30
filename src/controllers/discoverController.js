const isEmpty = require('../utils/isEmpty')
const Asset = require('../models/asset');

exports.discoverContents = async (req, res) => {
    const { page, per_page } = req.body;
    if(isEmpty(page) || isEmpty(per_page)) {
        return res.status(400).json({success: false, message: "Invalid Request!"})
    }
    let start = page - 1
    try {
        let assets = await Asset.find().sort("uploadedTime").skip(start).limit(per_page).exec();
        return res.status(200).json({success: true, assets});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
