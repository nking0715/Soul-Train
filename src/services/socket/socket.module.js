const { generateRandomChannelName, generateAccessToken } = require('../../helper/agora.helper');
const { selectRandomUser } = require('../../helper/socket.helper');
const isEmpty = require('../../utils/isEmpty');
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


    socket.on(SOCKET_IDS.QUIT, () => {
      this.handleQuit(socket, true);
    });

    socket.on(SOCKET_IDS.CONNECT, data => {
      this.handleCONNECT(socket, data);
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


      this.users[playerA].socket.emit(SOCKET_IDS.CONNECT_SUCCESS, {
        ...room,
        playerA,
        channelName,
        token: token1,
        playerB,
        starter
      });

      this.users[playerB].socket.emit(SOCKET_IDS.CONNECT_SUCCESS, {
        ...room,
        playerA,
        channelName,
        token: token2,
        playerB,
        starter
      });
      this.users[playerA].roomId = room.roomId;
      this.users[playerB].roomId = room.roomId;
      this.users[playerA].isOnline = true;
      this.users[playerB].isOnline = true;
      this.users[playerA].availableTime = 0;
      this.users[playerB].availableTime = 0;
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
    this.users[userId] = { socket, roomId: null, isOnline: true };
    // set userId of this socket
    this.sockets[currentSocketId].userId = userId;
    socket.emit(SOCKET_IDS.WAIT_BATTLE, 30000);
  }

  handleQuit(socket, isConnected = false) {
    const currentSocketId = socket.id;

    const roomId = this.sockets[currentSocketId].roomId;
    const userId = this.sockets[currentSocketId].userId;
    if (this.rooms.running[roomId]) {
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

  handleCONNECT(socket, data) {
    const currentSocketId = socket.id;
    const { userId } = data;
    const userInfo = this.users[userId];
    const currentTime = Math.floor(Date.now());
    this.sockets[currentSocketId].userId = userId;
    this.sockets[currentSocketId].socket = socket;
    if (!isEmpty(userInfo)) { // user already joined before.
      if (userInfo.availableTime >= currentTime && userInfo.isOnline == false) {
        const currentRoomId = userInfo.roomId;
        const roomInfo = this.newRooms[currentRoomId];
        const opponentUserId = roomInfo.players.playerA == userId ? roomInfo.players.playerB : roomInfo.players.playerA;
        if (this.users[opponentUserId].isOnline == true) {
          this.users[userId].socket = socket;
          this.users[userId].isOnline = true;

          // recover his prev roomInfo
          socket.emit(SOCKET_IDS.RECOVER, {
            ...roomInfo,
            playerA: roomInfo.players.playerA,
            playerB: roomInfo.players.playerB,
          });

          this.users[opponentUserId].socket.emit(SOCKET_IDS.CONTINUE, {});
        } else {

        }
      } else if (userInfo.isOnline == true) {
        console.log(userId, " already joined.");
      }
    } else {
      this.handleEnter(socket, { userId });
    }
  }

  handleDisconnect(socket) {
    const currentSocketId = socket.id;
    const socketInfo = this.sockets[currentSocketId];
    if (!socketInfo) return;
    const currentUserId = this.sockets[currentSocketId].userId;
    console.log(currentUserId, " lost the network");
    if (currentUserId) {
      this.users[currentUserId].isOnline = false;
      const currentTime = Math.floor(Date.now());
      this.users[currentUserId].availableTime = currentTime + 30 * 1000;
      const currentRoomId = currentUserId ? this.users[currentUserId].roomId : null;
      if (currentRoomId != null) {
        const opponentUserId = this.newRooms[currentRoomId].players.playerA == currentUserId ? this.newRooms[currentRoomId].players.playerB : this.newRooms[currentRoomId].players.playerA;
        this.users[opponentUserId].socket.emit(SOCKET_IDS.OPPONENT_DISCONNECTED, {
          time: 30000
        });
      } else {
        delete this.users[currentUserId];
      }
    }

    const indexUser = this.lobbyUserList.indexOf(currentUserId);
    this.lobbyUserList.splice(indexUser, 1);

    // get out from room
    if (socketInfo.roomId) {
      this.handleQuit(socket);
    }

    delete this.sockets[currentSocketId];
  }
}

module.exports = SocketHandler;