// Import necessary modules
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const authMiddleware = require('./middlewares/authMiddleware');
const userRoutes = require('./routes/userRoutes');
const agoraRoutes = require('./routes/agoraRoutes');
const profileRoutes = require('./routes/profileRoutes');
const postRoutes = require('./routes/postRoutes');
const api = require('./routes/api-router');
const webhookRoutes = require('./routes/webhook')
const cors = require('cors');
const fileUpload = require('express-fileupload');

// Load environment variables
dotenv.config();

// Connect to the database
const connectDB = require('./db');
connectDB();

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// Initialize socket.io
app.use(cors('*'));
const SocketHandler = require('./services/socket/socket');

new SocketHandler(io);

// Body parsers
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(fileUpload());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

app.use(express.static('public'));


app.get("/", (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
  // res.json({ message: "Welcome to SoulTrain App!" });
});

// User routes
app.use('/users', userRoutes);
app.use('/contentModerationWebhook', webhookRoutes);

// Profile routes with authentication and authorization
app.use(authMiddleware.authenticate);
app.use('/profile', profileRoutes);
app.use('/post', postRoutes);

// Api Router
app.use('/api', api);

// Agora routes
app.use('/agora', agoraRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
