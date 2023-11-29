const express = require('express');
const router = express.Router();

const { registerToken, updateToken, removeToken, updateNotification, getBadgeStatus, getListOfNotifications, testPushNotifications } = require('../controllers/notificationController');

router.post('/registerToken', registerToken);
router.post('/updateToken', updateToken);
router.post('/removeToken', removeToken);
router.post('/updateNotification', updateNotification);
router.get('/getBadgeStatus', getBadgeStatus);
router.get('/getListOfNotifications', getListOfNotifications);
router.post('/pushNotifications', testPushNotifications);

module.exports = router;
