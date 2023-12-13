const admin = require('firebase-admin');

exports.sendPushNotification = async (tokens, data, notification) => {
    try {
        const messages = tokens.map(token => ({
            token,
            data,
            notification
        }));
        console.log(messages);
        await admin.messaging().sendEach(messages);
        return true;
    } catch (error) {
        console.log('Error in pushNotifications: ', error);
        return false;
    }
}