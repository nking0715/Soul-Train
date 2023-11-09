const { generateRandomChannelName, generateAccessToken } = require('../../helper/agora.helper');
const { selectRandomUser } = require('../../helper/socket.helper');
const SOCKET_IDS = require('./sockProc');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.sockets = {}; // Initialize sockets, rooms, and this.users as class properties.
    this.rooms = { waiting: {}, running: {} };
    this.newRooms = {};
    this.lobbyUserList = [];
    this.users = {};
    this.roomId = 0;
    this.newRoomId = 0;
    this.timeoutId = null;

    setInterval(this.handleCreateRooms.bind(this), 10000);

    io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  handleConnection(socket) {
    const currentSocketId = socket.id;
    this.sockets[currentSocketId] = {
      userId: "",
      roomId: 0,
      socket,
    };

    socket.on(SOCKET_IDS.ENTER, data => {
      this.handleEnter(socket, data);
    });

    socket.on(SOCKET_IDS.QUIT, () => {
      this.handleQuit(socket, true);
    });

    socket.on(SOCKET_IDS.RECONNECT, data => {
      this.handleReconnect(socket, data);
    });

    socket.on("disconnect", () => {
      this.handleDisconnect(socket);
    });
  }

  handleCreateRooms() {
    let userList = this.lobbyUserList;
    while (this.lobbyUserList.length >= 2) {
      let randomIndexA = Math.floor(Math.random() * 100) % userList.length;
      let playerA = userList[randomIndexA];
      userList.splice(randomIndexA, 1);
      let randomIndexB = Math.floor(Math.random() * 100) % userList.length;
      let playerB = userList[randomIndexB];
      userList.splice(randomIndexB, 1);

      let room = {
        roomId: this.newRoomId,
        players: {
          playerA,
          playerB
        }
      }
      this.newRooms[this.newRoomId++] = room;
      this.lobbyUserList = userList;

      const starter = selectRandomUser(playerA, playerB);

      // start the battle
      clearInterval(this.timeoutId);
      const channelName = generateRandomChannelName();
      const token1 = generateAccessToken(channelName, 1);
      const token2 = generateAccessToken(channelName, 2);

      
      this.users[playerA].socket.emit(SOCKET_IDS.ENTER_SUCCESS, {
        ...room,
        playerA,
        playerB,
        starter
      });

      this.users[playerB].socket.emit(SOCKET_IDS.ENTER_SUCCESS, {
        ...room,
        playerA,
        playerB,
        starter
      });
      this.users[playerA].roomId = room.roomId;
      this.users[playerB].roomId = room.roomId;
    }
  }

  handleEnter(socket, data) {
    const currentSocketId = socket.id;
    // get userId from socket request
    const { userId } = data;
    // validate of this userId is not duplicated
    if (Object.keys(this.users).indexOf(userId) >= 0) {
      // this userId is duplicated
      socket.emit(SOCKET_IDS.USERID_DUPLICATED);
      return;
    }
    // add the user to the lobby space
    this.lobbyUserList.push(userId);

    // init data
    this.users[userId] = { socket, roomId: null };
    // set userId of this socket
    this.sockets[currentSocketId].userId = userId;
    socket.emit(SOCKET_IDS.REMAIN_TIME, 30000);
  }

  handleQuit(socket, isConnected = false) {
    const currentSocketId = socket.id;

    const roomId = this.sockets[currentSocketId].roomId;
    const userId = this.sockets[currentSocketId].userId;
    if (this.rooms.running[roomId]) {
      console.log("Request quit room is running. " + roomId);
      delete this.rooms.running[roomId].players[userId];
      const opponentName = Object.keys(this.rooms.running[roomId].players)[0];
      const opponentSocketId = this.rooms.running[roomId].players[opponentName].socketId;
      // delete running room
      delete this.rooms.running[roomId];

      this.sockets[opponentSocketId].socket.emit(SOCKET_IDS.QUIT_SUCCESS);
      isConnected && this.sockets[currentSocketId].socket.emit(SOCKET_IDS.QUIT_SUCCESS);
      // destroy oppoiste socket info
      this.sockets[opponentSocketId].roomId = 0;
      this.sockets[opponentSocketId].userId = "";
      delete this.users[opponentName];
      // send to opponent user to this user is outed, so this match is stopped and waiting
    } else if (this.rooms.waiting[roomId]) {
      delete this.rooms.waiting[roomId];
    }
    this.sockets[currentSocketId].roomId = 0;
    this.sockets[currentSocketId].userId = "";
    delete this.users[userId];
  }

  handleReconnect(socket, data) {
    const { userId } = data;
    this.users[userId].socket = socket;
  }

  handleDisconnect(socket) {
    const currentSocketId = socket.id;
    const socketInfo = this.sockets[currentSocketId];
    if (!socketInfo) return;
    // get out from room
    if (socketInfo.roomId) {
      this.handleQuit(socket);
    }
    const currentUserId = this.sockets[currentSocketId].userId;
    const currentRoomId = this.users[currentUserId].roomId;
    if(currentRoomId) {
      const currentRoom = this.newRooms[currentRoomId];
    }
    delete this.sockets[currentSocketId];
  }
}

module.exports = SocketHandler;