const express = require('express');
const userController = require('../controllers/userController');
const authService = require('../services/authService');

const router = express.Router();

router.get('/me', authService.authenticateToken, userController.getCurrentUser);
router.put('/me', authService.authenticateToken, userController.updateCurrentUser);

module.exports = router;