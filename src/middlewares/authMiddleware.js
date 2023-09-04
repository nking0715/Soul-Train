const jwt = require('jsonwebtoken');

// Authenticate a JWT token
exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const user = await jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Failed to authenticate token' });
  }
};

exports.isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  } else {
    res.status(401).send('Not authenticated');
  }
};