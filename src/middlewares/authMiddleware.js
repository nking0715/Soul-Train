const jwt = require('jsonwebtoken');

// Authenticate a JWT token
exports.authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
  
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.error('Failed to authenticate token', err);
        return res.status(403).json({ error: 'Failed to authenticate token' });
      }
  
      req.user = user;
      next();
    });
  };