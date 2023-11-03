const SOCKET_IDS = require('./sockProc');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.sockets = {}; // Initialize sockets, rooms, and this.users as class properties.
    this.rooms = { waiting: {}, running: {} };
    this.users = {};
    this.roomId = 0;
    this.timeoutId = null;

    io.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }


  handleConnection(socket) {
    const currentSocketId = socket.id;
    console.log("A client is connected: " + currentSocketId);

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

    socket.on("disconnect", () => {
      this.handleDisconnect(socket);
    });
  }

  handleEnter(socket, data) {
    const currentSocketId = socket.id;
    // get userId from socket request
    const { userId } = data;

    const createRoomAndEnter = () => {
      const newRoomId = ++this.roomId;
      // create waiting room and enter this room
      this.rooms.waiting[newRoomId] = {
        roomId: newRoomId, players: {
          [userId]: { socketId: currentSocketId }
        }
      };
      // if after 30s, this room is not auto-closed, close this room
      // bind user and room info to room
      this.sockets[currentSocketId].roomId = newRoomId;
      this.sockets[currentSocketId].userId = userId;
    };

    const updateRemainingTime = (socket) => {
      if (this.timeoutId) {
        socket.emit(SOCKET_IDS.REMAIN_TIME, this.timeoutId._idleTimeout);
      }
    }


    // validate of this userId is not duplicated
    if (Object.keys(this.users).indexOf(userId) >= 0) {
      // this userId is duplicated
      socket.emit(SOCKET_IDS.USERID_DUPLICATED);
      return;
    }

    // init data
    this.users[userId] = { socket, roomId: 0 };

    // set userId of this socket
    this.sockets[currentSocketId].userId = userId;
    const nUsers = Object.keys(this.users);
    // if this user create room

    if (nUsers & 1 == 0) {
      createRoomAndEnter();
    } else {
      // get waiting room Ids
      const waitingRoomIds = Object.keys(this.rooms.waiting);
      if (waitingRoomIds.length) {

        const enterRoomId = waitingRoomIds[0];
        let room = this.rooms.waiting[enterRoomId];
        let oppoisteUserId = Object.keys(this.rooms.waiting[enterRoomId].players)[0];


        // update room info
        room = {
          ...room, players: {
            ...room.players,
            [userId]: { socketId: currentSocketId }
          }
        };
        if (this.rooms.running[this.roomId]) delete this.rooms.running[roomId];
        // this room's status is running
        this.rooms.running[this.roomId] = room;
        delete this.rooms.waiting[this.roomId];
        // send result to clients enter a room
        const selectRandomUser = () => {
          const users = [userId, oppoisteUserId];
          const randomIndex = Math.floor(Math.random() % users.length);
          return users[randomIndex];
        }
        const starter = selectRandomUser();
        
        // start the battle
        clearInterval(this.timeoutId);
        socket.emit(SOCKET_IDS.ENTER_SUCCESS, {
          ...this.rooms.running[this.roomId],
          me: { userId },
          opposite: { userId: oppoisteUserId },
          starter
        });


        this.sockets[room.players[oppoisteUserId].socketId].socket.emit(SOCKET_IDS.ENTER_SUCCESS, {
          ...this.rooms.running[this.roomId],
          me: { userId: oppoisteUserId },
          opposite: { userId },
          starter
        });

        // bind user and room info to room
        this.sockets[currentSocketId].roomId = this.roomId;
        this.sockets[currentSocketId].userId = userId;
      } else {
        // wait the opponent for 30 sec
        this.timeoutId = setTimeout(() => {
          if (true) {
            // If the room has only one user (the creator), remove it
            delete this.rooms.waiting[this.roomId];
            this.timeoutId = null;
            console.log('Room removed due to inactivity.');
          }
        }, 30000);

        updateRemainingTime(socket);
        // no waiting rooms, you need create a room or send result to enter room is failed
        createRoomAndEnter();
      }
    }
  }

  handleQuit(socket, isConnected = false) {
    const currentSocketId = socket.id;

    const roomId = this.sockets[currentSocketId].roomId;
    const userId = this.sockets[currentSocketId].userId;
    if (this.rooms.running[roomId]) {
      console.log("Request quit room is running. " + roomId);
      delete this.rooms.running[roomId].players[userId];
      const oppositeName = Object.keys(this.rooms.running[roomId].players)[0];
      const oppositeSocketId = this.rooms.running[roomId].players[oppositeName].socketId;
      // delete running room
      delete this.rooms.running[roomId];

      this.sockets[oppositeSocketId].socket.emit(SOCKET_IDS.QUIT_SUCCESS);
      isConnected && this.sockets[currentSocketId].socket.emit(SOCKET_IDS.QUIT_SUCCESS);
      // destroy oppoiste socket info
      this.sockets[oppositeSocketId].roomId = 0;
      this.sockets[oppositeSocketId].userId = "";
      delete this.users[oppositeName];
      // send to opposite user to this user is outed, so this match is stopped and waiting
    } else if (this.rooms.waiting[roomId]) {
      delete this.rooms.waiting[roomId];
    }
    this.sockets[currentSocketId].roomId = 0;
    this.sockets[currentSocketId].userId = "";
    delete this.users[userId];
  }

  handleDisconnect(socket) {
    const currentSocketId = socket.id;
    console.log("A client is disconnected: " + currentSocketId);
    const socketInfo = this.sockets[currentSocketId];
    if (!socketInfo) return;
    // get out from room
    if (socketInfo.roomId) {
      this.handleQuit(socket);
    }
    delete this.sockets[currentSocketId];
  }
}

module.exports = SocketHandler;
