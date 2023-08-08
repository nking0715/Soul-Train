const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const authMiddleware = require('./middlewares/authMiddleware');
const userRoutes = require('./routes/userRoutes');
const agoraRoutes = require('./routes/agoraRoutes');
const profileRoutes = require('./routes/profileRoutes');
const https = require('https'); // Added for HTTPS support
const fs = require('fs'); // Added for reading SSL files

// Load environment variables
dotenv.config();

// Connect to database
const connectDB = require('./db');
connectDB();

// Passport.js Setup
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/users/auth/google/callback'
}, async (accessToken, refreshToken, profile, cb) => {
  let user = await User.findOne({ googleId: profile.id });

  if (user) {
    cb(null, user);
  } else {
    user = await User.create({
      googleId: profile.id,
      displayName: profile.displayName,
      email: profile.emails[0].value
    });
    cb(null, user);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

// Create the Express app
const app = express();

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());

// Routes
app.use('/users', userRoutes);

// Secure the profile routes
app.use(authMiddleware.authenticate);
app.use(profileRoutes);

app.use('/agora', agoraRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

// Start the server
const PORT = process.env.PORT || 3000;

// Check if in production and set up HTTPS
if (process.env.NODE_ENV === 'production') {
  const privateKey = fs.readFileSync('./ssl/example.com+5-key.pem', 'utf8');
  const certificate = fs.readFileSync('./ssl/example.com+5.pem', 'utf8');
  const credentials = { key: privateKey, cert: certificate };
  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(PORT, () => {
      console.log(`HTTPS Server running on port ${PORT}`);
  });
} else {
  app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
  });
}