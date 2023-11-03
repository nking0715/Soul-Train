const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');
require('dotenv').config();
require('./src/socket/index.socket')(io);

app.use(cors());
// get env vars
const { SERVER_PORT } = process.env;
// set public folder
app.use(express.static('public'));
// handle 404 error
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

http.listen(SERVER_PORT, () => {
  console.log('listening on *:' + SERVER_PORT);
});
