const jwt = require('jsonwebtoken');

exports.authenticate = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Replace 'YOUR_SECRET_KEY' with an actual secret key
        req.userId = decoded._id; // Store user id from JWT to request object
        next();
    } catch (ex) {
        res.status(400).json({ message: 'Invalid token.' });
    }
};
