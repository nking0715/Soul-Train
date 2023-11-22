const admin = require('firebase-admin');
const serviceAccount = require('../credentials/google-services.json');
const User = require('../models/user');

exports.registerToken = async (req, res) => {
  try {
    const token = req.body.token;
    const userId = req.user.id;
    const user = await User.findById(userId)
      .select('pushNotificationTokens');
    const registeredTokens = user.pushNotificationTokens || [];
    for (let i = 0; i < registeredTokens.length; i++) {
      if (registeredTokens[i] == token) return res.status(400).json({ success: false, message: 'Already registered token' });
    }
    user.pushNotificationTokens.push(token);
    await user.save();
    return res.status(200).json({ success: true, message: 'Successfully registered a token.' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

exports.removeToken = async (req, res) => {
  try {
    const token = req.body.token;
    const userId = req.user.id;
    const user = User.findById(userId)
      .select('pushNotificationTokens');
    const registeredTokens = user.pushNotificationTokens;
    for (let i = 0; i < registeredTokens.length; i++) {
      if (registeredTokens[i] == token) {
        user.pushNotificationTokens.pop(token);
        await user.save();
        return res.status(200).json({ success: true, message: 'Successfully removed a token.' });
      }
    }
    return res.status(400).json({ success: false, message: 'Not found the token.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

exports.pushNotifications = async (req, res) => {
  try {
    const { title, body, topic } = req.body;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    const users = await User.find().select('pushNotificationTokens');
    let tokens = [];
    users.map(user => {
      const registrationToken = user.pushNotificationTokens || [];
      tokens.push(...registrationToken);
    });
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