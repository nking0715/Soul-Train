const admin = require('firebase-admin');
const serviceAccount = require('../credentials/google-services.json');
const User = require('../models/user');
const FcmToken = require('../models/fcmToken');

exports.registerToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, deviceInfo } = req.body;
    const newToken = new FcmToken({ userId, token, deviceInfo });
    await newToken.save();
    return res.status(200).json({ success: true, message: 'Successfully registered a token.' });
  } catch (error) {
    console.log("Error in registerToken: ", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.updateToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    await FcmToken.findOneAndUpdate({ userId }, { token: token });
    return res.status(200).json({ success: true, message: 'Successfully updated a token.' });
  } catch (error) {
    console.log("Error in updateToken: ", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.removeToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    await FcmToken.findOneAndDelete({ userId, token });
    return res.status(200).json({ success: true, message: 'Successfully removed a token.' });
  } catch (error) {
    console.log("Error in removeToken: ", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.pushNotifications = async (req, res) => {
  try {
    const { title, body, topic } = req.body;
    let tokens = [];
    const fcmTokens = await FcmToken.find().select('token');
    fcmTokens.map(fcmToken => {
      tokens.push(fcmToken.token);
    })
    await admin.messaging().subscribeToTopic(tokens, topic);
    const message = {
      notification: {
        title: title,
        body: body,
      },
      topic: topic,
    };
    await admin.messaging().send(message);
    return res.status(200).json({ status: true, message: 'Successfully pushed notification.' });
  } catch (error) {
    console.log('Error in pushNotifications: ', error);
    return res.status(500).json({ status: false, message: error.message });
  }
}