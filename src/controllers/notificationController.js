const admin = require('firebase-admin');
const FcmToken = require('../models/fcmToken');
const Notification = require('../models/notification');

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

exports.updateNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.body.notificationId;
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    // Remove the userId from usersToRead
    await Notification.updateOne(
      { _id: notificationId },
      { $pull: { usersToRead: userId } }
    );
    // Check if usersToRead is now empty
    const updatedNotification = await Notification.findById(notificationId);
    if (updatedNotification.usersToRead.length === 0) {
      // If no users left to read, delete the notification
      await Notification.deleteOne({ _id: notificationId });
    }
    return res.status(200).json({ success: true, message: 'Notification updated' });
  } catch (error) {
    console.log('Error in updateNotification: ', error.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}

exports.getBadgeStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const checkPoint = req.query.time;
    // Convert checkPoint to a Date object if it's not already
    let checkPointDate;

    if (isEmpty(checkPoint)) {
      checkPointDate = new Date('2023-01-01T00:00:00.000Z');
    } else {
      // Otherwise, convert checkPoint to a Date object
      checkPointDate = new Date(checkPoint);
    }

    // Search for notifications where userId is in usersToRead
    const notifications = await Notification.find({
      usersToRead: { $in: [userId] },
      createdAt: { $gt: checkPointDate }
    });

    // Check if any notifications are found
    const hasUnreadNotifications = notifications.length > 0;

    return res.status(200).json({
      success: true,
      hasUnreadNotifications: hasUnreadNotifications
    });
  } catch (error) {
    console.log('Error in getBadgeStatus: ', error.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}

exports.getListOfNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    // Search for notifications where userId is in usersToRead
    const notifications = await Notification.find({ usersToRead: { $in: [userId] } })
      .select('data notification')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.log('Error in getListOfNotifications: ', error.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}

exports.testPushNotifications = async (req, res) => {
  try {
    const { token, title, body, type, value } = req.body;
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        type: type,
        value: value
      },
      token: token
    };
    await admin.messaging().send(message);
    return res.status(200).json({ status: true, message: 'Successfully pushed notification.' });
  } catch (error) {
    console.log('Error in pushNotifications: ', error);
    return res.status(500).json({ status: false, message: error.message });
  }
}