// Import necessary modules
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const authMiddleware = require('./middlewares/authMiddleware');
const userRoutes = require('./routes/userRoutes');
const agoraRoutes = require('./routes/agoraRoutes');
const profileRoutes = require('./routes/profileRoutes');

// Load environment variables
dotenv.config();

// Connect to the database
const connectDB = require('./db');
connectDB();

// Create the Express app
const app = express();

// Set up middlewares

// Body parsers
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    name: 'sid',
    secure: false,
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days in milliseconds
  }
}));

// Custom middleware to refresh the session's last access timestamp
app.use((req, res, next) => {
  req.session.lastAccess = Date.now();
  next();
});

// User routes
app.use('/users', userRoutes);

// Profile routes with authentication and authorization
app.use(authMiddleware.authenticate);
app.use(profileRoutes);

// Agora routes
app.use('/agora', agoraRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
