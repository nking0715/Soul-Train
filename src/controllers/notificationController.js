const admin = require('firebase-admin');
const FcmToken = require('../models/fcmToken');
const Notification = require('../models/notification');
const { parseQueryParam } = require('../utils/queryUtils');

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
      { $addToSet: { usersAlreadyRead: userId } }
    );
    return res.status(200).json({ success: true, message: 'Notification updated' });
  } catch (error) {
    console.log('Error in updateNotification: ', error.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}

exports.getBadgeStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // Count notifications where userId is in usersToRead and not in usersAlreadyRead
    const unreadCount = await Notification.countDocuments({
      usersToRead: { $in: [userId] },
      usersAlreadyRead: { $nin: [userId] }
    });

    return res.status(200).json({
      success: true,
      hasUnreadNotifications: unreadCount > 0
    });
  } catch (error) {
    console.log('Error in getBadgeStatus: ', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
}

exports.getListOfNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, perPage = 10 } = req.query
    const pageConverted = parseQueryParam(page, 1);
    const perPageConverted = parseQueryParam(perPage, 10);
    const skip = (pageConverted - 1) * perPageConverted;
    // Search for notifications where userId is in usersToRead
    const notifications = await Notification.find({ usersToRead: { $in: [userId] } })
      .populate({
        path: 'data.publisher',
        model: 'User',
        select: 'profilePicture'
      })
      .select('data notification usersAlreadyRead createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPageConverted);

    // Add isUnread boolean to each notification
    const modifiedNotifications = notifications.map(notification => {
      const isUnread = !notification.usersAlreadyRead.includes(userId);
      const { usersAlreadyRead, ...rest } = notification.toObject();
      return {
        ...rest, // Convert document to a plain object
        isUnread,
      };
    });

    return res.status(200).json({ success: true, notifications: modifiedNotifications });

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