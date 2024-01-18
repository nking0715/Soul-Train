// Import necessary modules
const express = require('express');
const session = require('express-session');
const http = require('http');
const httpProxy = require('http-proxy');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const serviceAccount = require('./credentials/google-services.json');
const authMiddleware = require('./middlewares/authMiddleware');
const userRoutes = require('./routes/userRoutes');
const agoraRoutes = require('./routes/agoraRoutes');
const profileRoutes = require('./routes/profileRoutes');
const postRoutes = require('./routes/postRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const matchRoutes = require('./routes/matchRoutes');

const api = require('./routes/api-router');
const webhookRoutes = require('./routes/webhook');
const searchRoutes = require('./routes/searchRoutes');
const cors = require('cors');
const fileUpload = require('express-fileupload');

// Load environment variables
dotenv.config();

// Connect to the database

const connectDB = require('./db');
connectDB();

const app = express();

// Initialize socket.io
app.use(cors('*'));
const server = require('http').createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: "*", // Allow requests from any origin
  }
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const SocketHandler = require('./services/socket/socket.module');
new SocketHandler(io);

// Body parsers
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(fileUpload());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session setup
// app.use(session({
//   secret: process.env.SESSION_SECRET,
//   resave: false,
//   saveUninitialized: true,
//   cookie: {
//     name: 'sid',
//     secure: false,
//     maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days in milliseconds
//   }
// }));

// Custom middleware to refresh the session's last access timestamp
app.use((req, res, next) => {
  // req.session.lastAccess = Date.now();
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
// app.use(authMiddleware.authenticate);
app.use('/profile', profileRoutes);
app.use('/post', postRoutes);
app.use('/notification', notificationRoutes);
app.use('/match', matchRoutes)
// Api Router
app.use('/api', api);
app.use('/search', searchRoutes);

// Agora routes
app.use('/agora', agoraRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

httpProxy.createServer({
  target: 'ws://dev.soultrain.app:3000',
  ws: true
}).listen(5000);

// Start the Express server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
