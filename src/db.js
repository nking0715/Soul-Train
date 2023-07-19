const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    // Connect to the database
    mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Handle connection events
    const db = mongoose.connection;
    db.on('error', console.error.bind(console, 'MongoDB connection error:'));
    db.once('open', () => {
      console.log('MongoDB connection successful');
    });
  } catch (err) {
    // Log error message to console and exit process with error code
    console.error(err.message);
    process.exit(1);
  }
}

// Export connectDB function
module.exports = connectDB;
