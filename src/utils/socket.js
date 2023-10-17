const socketIO = require('socket.io');

let io;

function initialize(server) {
  io = socketIO(server);
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

module.exports = {
  initialize,
  getIO
};
