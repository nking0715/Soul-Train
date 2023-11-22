const express = require('express');
const router = express.Router();

const { registerToken, updateToken, removeToken, pushNotifications } = require('../controllers/notificationController');

router.post('/registerToken', registerToken);
router.post('/updateToken', updateToken);
router.post('/removeToken', removeToken);
router.post('/pushNotifications', pushNotifications);

module.exports = router;
