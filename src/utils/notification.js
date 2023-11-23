const admin = require('firebase-admin');

exports.sendPushNotification = async (tokens, data, notification) => {
    try {
        if (Array.isArray(tokens)) {
            const messages = tokens.map(token => ({
                token,
                data,
                notification
            }));
            console.log(messages);
            await admin.messaging().sendEach(messages);
        } else {
            const message = {
                token,
                data,
                notification
            };
            await admin.messaging().send(message);
        }
        return true;
    } catch (error) {
        console.log('Error in pushNotifications: ', error);
        return false;
    }
}