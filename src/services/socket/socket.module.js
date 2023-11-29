const { getProfile } = require('../../controllers/profileController');
const { generateRandomChannelName, generateAccessToken } = require('../../helper/agora.helper');
const { selectRandomUser } = require('../../helper/socket.helper');
const isEmpty = require('../../utils/isEmpty');
const SOCKET_IDS = require('./sockProc');

class SocketHandler {

  constructor(io) {
    this.io = io;
    this.sockets = {}; // Initialize sockets, rooms, and this.users as class properties.
    this.rooms = {};
    this.lobbyUserList = [];
    this.users = {};
    this.roomId = 0;
    this.timeoutId = null;
    this.loopTime = 15000;
    setInterval(this.handleCreateRooms.bind(this), this.loopTime);
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
      this.handleConnect(socket, data);
    });

    socket.on(SOCKET_IDS.USER_DISCONNECT, data => {
      this.handleDisconnect(socket, data);
    });

    socket.on("disconnect", () => {
      this.handleDisconnect(socket,);
    });
  }

  handleCleanLobby() {
    try {
      const currentTime = new Date();
      Object.keys(this.users).forEach((userId) => {
        const user = this.users[userId];
        const timeDifferenceInSeconds = Math.floor((currentTime - user.enterLobbyTime) / 1000);
        if (timeDifferenceInSeconds > 30 && !user.isStarted) {
          // need to notice to the frontend side.
          console.log('unnessary user is ', userId);
          // Disconnect the user
          delete this.users[userId]; // Remove the user from the users dictionary
          this.lobbyUserList = this.lobbyUserList.filter((id) => id !== userId); // Remove from lobbyUserList
        }
      });
    } catch (e) {
      console.log('handleCleanLobby error is ', e);
    }
  }

  handleCreateRooms() {
    try {
      // clean lobbyUserList before create rooms.
      this.handleCleanLobby();
      let userList = this.lobbyUserList;
      console.log("this.lobbyUserList is ", this.lobbyUserList);
      while (this.lobbyUserList.length >= 2) {
        let randomIndexA = Math.floor(Math.random() * 100) % userList.length;
        let playerA = userList[randomIndexA];
        userList.splice(randomIndexA, 1);
        let randomIndexB = Math.floor(Math.random() * 100) % userList.length;
        let playerB = userList[randomIndexB];
        userList.splice(randomIndexB, 1);
        console.log("update lobbyUserList", userList);

        this.lobbyUserList = userList;

        const starter = selectRandomUser(playerA, playerB);

        // start the battle
        clearInterval(this.timeoutId);
        const channelName = generateRandomChannelName();
        const tokenA = generateAccessToken(channelName, 1);
        const tokenB = generateAccessToken(channelName, 2);

        let room = {
          roomId: this.roomId,
          playerA,
          playerB,
          channelName,
          starter,
          tokenA,
          tokenB
        }

        this.rooms[this.roomId++] = room;

        console.log("GET_INFO: current userId", playerA, this.users[playerA].userId);
        console.log("GET_INFO: opponent userId", this.users[playerB].userId);
        console.log("");
        console.log("GET_INFO: current userId", playerB, this.users[playerB].userId);
        console.log("GET_INFO: opponent userId", this.users[playerA].userId);

        this.users[playerA].socket.emit(SOCKET_IDS.GET_BATTLE_INFO, {
          ...room,
          token: tokenA,
          opponentUserId: playerB,
          opponentUserName: this.users[playerB].userName,
          opponentArtistName: this.users[playerB].userArtistName,
          opponentProfileURL: this.users[playerB].userProfileURL
        });

        this.users[playerB].socket.emit(SOCKET_IDS.GET_BATTLE_INFO, {
          ...room,
          token: tokenB,
          opponentUserId: playerA,
          opponentUserName: this.users[playerA].userName,
          opponentArtistName: this.users[playerA].userArtistName,
          opponentProfileURL: this.users[playerA].userProfileURL
        });

        this.users[playerA].roomId = room.roomId;
        this.users[playerB].roomId = room.roomId;
        this.users[playerA].isOnline = true;
        this.users[playerB].isOnline = true;
        this.users[playerA].isStarted = true;
        this.users[playerB].isStarted = true;
        this.users[playerA].availableTime = 0;
        this.users[playerB].availableTime = 0;
      }
    } catch (e) {
      console.log('handleCreateRooms error is ', e);
    }

  }

  handleEnterLobby(socket, data) {
    try {
      const currentSocketId = socket.id;
      // get userId from socket request
      const { userId, userName, userProfileURL, userArtistName } = data;
      // Get the current time
      const enterLobbyTime = new Date();
      // validate of this userId is not duplicated
      if (Object.keys(this.users).indexOf(userId) >= 0) {
        // this userId is duplicated
        console.log('USERID_DUPLICATED', userId);
        socket.emit(SOCKET_IDS.USERID_DUPLICATED);
        return;
      }
      // add the user to the lobby space
      this.lobbyUserList.push(userId);
      // init data
      this.users[userId] = { socket, roomId: null, isStarted: false, isOnline: true, userName, userProfileURL, userArtistName, enterLobbyTime };
      // set userId of this socket
      this.sockets[currentSocketId].userId = userId;
      socket.emit(SOCKET_IDS.WAIT_OPPONENT, 30000);
    } catch (e) {
      console.log('handleCreateRooms error is ', e);
    }
  }

  handleQuit(socket, isConnected = false) {
    try {
      const currentSocketId = socket.id;
      const roomId = this.sockets[currentSocketId]?.roomId;
      const userId = this.sockets[currentSocketId]?.userId;
      if (this.rooms[roomId]) {
        const opponentUserId = this.rooms[roomId].playerA == userId ? this.rooms[roomId].playerB : this.rooms[roomId].playerA;
        this.users[userId].socket.emit(SOCKET_IDS.QUIT_SUCCESS);
        isConnected && this.users[opponentUserId].socket.emit(SOCKET_IDS.QUIT_SUCCESS);
        const opponentInfo = this.users[opponentUserId];
        if (opponentInfo) {
          const opponentSocketId = opponentInfo.socket.id;
          delete this.sockets[opponentSocketId];
        }
        delete this.sockets[currentSocketId];
        delete this.users[userId];
        delete this.users[opponentUserId];
      }
    } catch (e) {
      console.log('handleQuit error is ', e);
    }
  }

  handleConnect(socket, data) {
    try {
      const currentSocketId = socket.id;
      const { userId, userName, userProfileURL, userArtistName } = data;
      console.log('userList ', this.lobbyUserList);
      console.log("connect is userId ", userId);

      const currentTime = Math.floor(Date.now());
      this.sockets[currentSocketId] = {
        userId,
        roomId: 0,
        socket,
      };
      const userInfo = this.users[userId];
      if (!isEmpty(userInfo)) { // user already joined before.
        console.log(`${userId} online status is ${userInfo.isOnline}`);
        // He lost his network and tries to join again now.
        if (userInfo.availableTime >= currentTime && userInfo.isOnline == false) {
          console.log("user is trying to join again", userId);
          const currentRoomId = userInfo.roomId;
          const roomInfo = this.rooms[currentRoomId];
          const opponentUserId = roomInfo.playerA == userId ? roomInfo.playerB : roomInfo.playerA;
          this.users[userId].socket = socket;
          this.users[userId].isOnline = true;
          if (this.users[opponentUserId].isOnline == true) {
            // recover his prev roomInfo
            socket.emit(SOCKET_IDS.RECOVER, {
              ...roomInfo,
              playerA: roomInfo.playerA,
              playerB: roomInfo.playerB,
            });
            this.users[opponentUserId].socket.emit(SOCKET_IDS.CONTINUE, {});
          }
        } else if (userInfo.availableTime < currentTime && userInfo.isOnline == false) {
          // User is trying to join after 30 sec again because he lost his network last match.
          console.log('user is trying to join now after 30 sec');
          delete this.users[userId];
          this.handleEnterLobby(socket, { userId, userName, userProfileURL, userArtistName });
        } else {
          // need a new API for frontend side.
          console.log(userId, " already joined.");
        }
      } else {
        this.handleEnterLobby(socket, { userId, userName, userProfileURL, userArtistName });
      }
    } catch (e) {
      console.log('handleConnect error is ', e);
    }
  }

  handleDisconnect(socket, data) {
    try {
      if (data) {
        const { userId } = data;
        console.log("disconnect param userId: ", userId);
      }

      const currentSocketId = socket.id;
      const socketInfo = this.sockets[currentSocketId];
      if (!socketInfo) return;
      const currentUserId = this.sockets[currentSocketId].userId;
      const currentUserInfo = this.users[currentUserId];
      if (currentUserId && currentUserInfo) {
        currentUserInfo.isOnline = false;
        const currentTime = Math.floor(Date.now());
        currentUserInfo.availableTime = currentTime + 30 * 1000;
        const currentRoomId = currentUserId ? currentUserInfo.roomId : null;

        if (currentRoomId !== null) {
          console.log("disconnect currentRoomId is ", currentRoomId);
          const opponentUserId = this.rooms[currentRoomId].playerA == currentUserId ? this.rooms[currentRoomId].playerB : this.rooms[currentRoomId].playerA;
          console.log("disconnect opponentUserId is ", opponentUserId);
          if (this.users[opponentUserId] && this.users[opponentUserId]?.isOnline) {
            this.users[opponentUserId].socket.emit(SOCKET_IDS.OPPONENT_DISCONNECTED, {
              time: 30000,
              opponentUserId: currentUserId,
              opponentUserName: currentUserInfo.userName,
              opponentProfileURL: currentUserInfo.userProfileURL
            });
          } else {
            // get out from room
            this.handleQuit(socket);
          }
        } else {
          delete this.users[currentUserId];
        }
      }
      const indexUser = this.lobbyUserList.indexOf(currentUserId);
      this.lobbyUserList.splice(indexUser, 1);
      delete this.sockets[currentSocketId];
    } catch (e) {
      console.log('handleDisconnect error is ', e);
    }
  }
}
module.exports = SocketHandler;