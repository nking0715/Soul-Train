const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const authMiddleware = require('./middlewares/authMiddleware');
const userRoutes = require('./routes/userRoutes');
const agoraRoutes = require('./routes/agoraRoutes');
const profileRoutes = require('./routes/profileRoutes');

// Import database connection function
const connectDB = require('./db');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Create the Express app
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware
app.use(express.json());

// Routes
app.use('/users', userRoutes);

// Secure the profile routes
app.use(authMiddleware.authenticate);
app.use(profileRoutes);

app.use('/agora', agoraRoutes);

app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});