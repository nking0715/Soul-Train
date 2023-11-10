const express = require('express');
const router = express.Router();

const { registerToken, removeToken, pushNotifications } = require('../controllers/notificationController');

router.post('/registerToken', registerToken);
router.post('/removeToken', removeToken);
router.post('/pushNotifications', pushNotifications);

module.exports = router;
