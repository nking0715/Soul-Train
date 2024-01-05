const { generateRandomChannelName, generateAccessToken, getRequireResourceId, startRecording, getRecordingStatus, saveRecording, updateLayout } = require('../../helper/agora.helper');
const { selectRandomUser, selectRandomMusic } = require('../../helper/socket.helper');
const isEmpty = require('../../utils/isEmpty');
const SOCKET_IDS = require('./sockProc');
const { RtcRole } = require('agora-token');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.sockets = {}; // Initialize sockets, rooms, and this.users as class properties.
    this.rooms = {};
    this.lobbyUserList = [];
    this.channelInfoList = {};
    this.channelList = [];
    this.channelMiddleLayoutList = [];
    this.channelSaveList = [];
    this.users = {};
    this.roomId = 0;
    this.timeoutId = null;
    this.loopCreateTime = 15000;
    this.loopLiveBattleTime = 5000;
    setInterval(this.handleLiveBattle.bind(this), this.loopLiveBattleTime);
    setInterval(this.handleCreateRooms.bind(this), this.loopCreateTime);
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

    socket.on(SOCKET_IDS.RECONNECT, data => {
      this.handleReConnect(socket, data);
    });

    socket.on(SOCKET_IDS.START_RECORDING, data => {
      this.handleStartRecording(socket, data);
    });

    socket.on(SOCKET_IDS.SAVE_RECORDING, data => {
      this.handleSaveRecording(socket, data);
    });

    socket.on(SOCKET_IDS.UPDATE_LAYOUT, data => {
      this.handleUpdateLayout(socket, data);
    });

    // user leave event 
    socket.on(SOCKET_IDS.USER_DISCONNECT, data => {
      this.handleLeave(socket, data);
    });

    // network disconnect
    socket.on("disconnect", () => {
      this.handleDisconnect(socket);
    });
  }

  handleCleanLobby() {
    try {
      const currentTime = new Date();
      Object.keys(this.users).forEach((userId) => {
        const user = this.users[userId];
        const timeDifferenceInSeconds = Math.floor((currentTime - user.enterLobbyTime) / 1000);
        if (timeDifferenceInSeconds > 60 && !user.isStarted) {
          // need to notice to the frontend side.
          console.log('unnessary user is ', userId);
          // Disconnect the user
          this.lobbyUserList = this.lobbyUserList.filter((id) => id !== userId); // Remove from lobbyUserList
        }
      });
    } catch (e) {
      console.log('handleCleanLobby error is ', e);
    }
  }

  handleLiveBattle() {
    const currentTime = new Date();
    for (var i = 0; i < this.roomId; i++) {
      let roomInfo = this.rooms[i];
      const timeDifferenceInSeconds = Math.floor((currentTime - roomInfo.createdTime) / 1000);
      if (timeDifferenceInSeconds == 15) { // Get ready point -- Live Battle
        this.users[roomInfo.playerA].socket.emit(SOCKET_IDS.GET_READY_FRIST_DANCER, {
          time: 5000
        });
        this.users[roomInfo.playerB].socket.emit(SOCKET_IDS.GET_READY_FRIST_DANCER, {
          time: 5000
        });
      }

      // after 5 seconds first user will start first
      if (timeDifferenceInSeconds == 20) { // first user start battle -- Live Battle
        this.users[roomInfo.playerA].socket.emit(SOCKET_IDS.START_FRIST_DANCER, {
          time: 30000
        });
        this.users[roomInfo.playerB].socket.emit(SOCKET_IDS.START_FRIST_DANCER, {
          time: 30000
        });
      }

      // after 30 seconds first user battle finished, it means Get ready point for second user.
      if (timeDifferenceInSeconds == 50) { // Get ready point -- Live Battle
        this.users[roomInfo.playerA].socket.emit(SOCKET_IDS.GET_READY_SECOND_DANCER, {
          time: 5000
        });
        this.users[roomInfo.playerB].socket.emit(SOCKET_IDS.GET_READY_SECOND_DANCER, {
          time: 5000
        });
      }

      // after 5 seconds second user will start then
      if (timeDifferenceInSeconds == 55) { // second user start battle -- Live Battle
        this.users[roomInfo.playerA].socket.emit(SOCKET_IDS.START_SECOND_DANCER, {
          time: 30000
        });
        this.users[roomInfo.playerB].socket.emit(SOCKET_IDS.START_SECOND_DANCER, {
          time: 30000
        });
      }

      // after 30 seconds second user battle finished, it means already finished the whole battle
      if (timeDifferenceInSeconds == 85) { // Get ready point -- Live Battle
        this.users[roomInfo.playerA].socket.emit(SOCKET_IDS.FINISH_BATTLE, {
          time: 5000
        });
        this.users[roomInfo.playerB].socket.emit(SOCKET_IDS.FINISH_BATTLE, {
          time: 5000
        });
      }
    }
  }

  handleSaveRecording(socket, data) {
    try {
      const { channelName } = data;
      // console.log('saveRecording api', channelName);
      let recordingDefaultUID = 9999;
      // remove the channelName from startlist
      this.channelList = this.channelList.filter(item => item !== channelName);

      if (!this.channelSaveList.includes(String(channelName))) {
        this.channelSaveList.push(String(channelName));
      } else {
        console.log('channel is already saved the recording', channelName);
        return;
      }

      if (
        this.channelInfoList[channelName]
      ) {
        const resourceId = this.channelInfoList[channelName].resourceId;
        const sid = this.channelInfoList[channelName].sid;
        // console.log("save sid is ", sid);
        saveRecording(resourceId, String(channelName), sid, recordingDefaultUID).then(res => {
          console.log("save recording data success", res);
        }).catch(err => {
          console.log("error save recording data is ", err);
        });
      }
    } catch (e) {
      console.log('handleCreateRooms error is ', e);
    }
  }


  handleStartRecording(socket, data) {
    try {
      const { channelName } = data;
      console.log('startRecording api', channelName);
      if (!this.channelList.includes(String(channelName))) {
        this.channelList.push(String(channelName));
      } else {
        console.log('channel is already started the recording', channelName);
        return;
      }
      let recordingDefaultUID = 9999;
      let recordingToken = generateAccessToken(String(channelName), RtcRole.SUBSCRIBER, recordingDefaultUID);
      getRequireResourceId(String(channelName), recordingDefaultUID).then(resourceId => {
        startRecording(resourceId, String(channelName), recordingDefaultUID, recordingToken).then(res => {
          const currentTime = Math.floor(Date.now());

          this.channelInfoList[channelName] = {
            resourceId: res.resourceId,
            sid: res.sid,
            startTime: currentTime
          };

          updateLayout(resourceId, String(channelName), res.sid, recordingDefaultUID, 1, 2).then(res => {
            console.log("start update layout success");
          }).catch(err => {
            console.log("error updateLayout data is ", err);
          })
        }).catch(err => {
          console.log("error start recording data is ", err);
        });
      }).catch(err => {
        console.log('require resource id error', err);
      });
    } catch (e) {
      console.log('handleCreateRooms error is ', e);
    }
  }

  handleUpdateLayout(socket, data) {
    try {
      const { channelName } = data;
      console.log('handleUpdateLayout api', channelName);
      if (!this.channelMiddleLayoutList.includes(String(channelName))) {
        this.channelMiddleLayoutList.push(String(channelName));
      } else {
        console.log('channel is already handleUpdateLayout', channelName);
        return;
      }
      let recordingDefaultUID = 9999;
      let channelInfo = this.channelInfoList[channelName];

      updateLayout(channelInfo.resourceId, String(channelName), channelInfo.sid, recordingDefaultUID, 2, 1).then(res => {
        console.log("middle update layout success");
      }).catch(err => {
        console.log("error updateLayout data is ", err);
      })
    } catch (e) {
      console.log('handleUpdateLayout error is ', e);
    }
  }

  handleCreateRooms() {
    try {
      // clean lobbyUserList before create rooms.
      this.handleCleanLobby();
      let starterDefaultUID = 1;
      let opponentDefaultUID = 2;

      let userList = this.lobbyUserList;
      // console.log("this.lobbyUserList is ", this.lobbyUserList);
      const currentTime = Math.floor(Date.now());
      let recordingDefaultUID = 9999;
      
      for (var i = 0; i < this.channelList.length; i++) {
        let channelName = this.channelList[i];
        let channelInfo = this.channelInfoList[channelName];
        const timeDifferenceInSeconds = Math.floor((currentTime - channelInfo.startTime) / 1000);

        if (timeDifferenceInSeconds == 30) {
          updateLayout(channelInfo.resourceId, String(channelName), channelInfo.sid, recordingDefaultUID, 2, 1).then(res => {
            console.log("middle update laypoput success");
          }).catch(err => {
            console.log("error updateLayout data is ", err);
          })
        }
      }

      while (this.lobbyUserList.length >= 2) {
        let randomIndexA = Math.floor(Math.random() * 100) % userList.length;
        let playerA = userList[randomIndexA];
        userList.splice(randomIndexA, 1);
        let randomIndexB = Math.floor(Math.random() * 100) % userList.length;
        let playerB = userList[randomIndexB];
        userList.splice(randomIndexB, 1);
        this.lobbyUserList = userList;

        let starter = selectRandomUser(playerA, playerB);
        // start the battle
        clearInterval(this.timeoutId);
        let channelName = generateRandomChannelName();

        let role = RtcRole.PUBLISHER;
        let tokenA = generateAccessToken(channelName, role, starterDefaultUID);
        let tokenB = generateAccessToken(channelName, role, opponentDefaultUID);
        let musicURL = selectRandomMusic();
        let room = {
          roomId: this.roomId,
          playerA,
          playerB,
          starterUID: starterDefaultUID,
          opponentUID: opponentDefaultUID,
          musicURL,
          channelName,
          starter,
          createdTime: new Date(),
          resourceId: '',  // recording info
          sid: '',         // recording info          
          tokenA, // starter token
          tokenB  // opponent token
        }

        this.rooms[this.roomId++] = room;

        console.log("GET_INFO: current userInfo", playerA, this.users[playerA].userName);
        console.log("GET_INFO: opponent userInfo", this.users[playerB].userId, this.users[playerB].userName);
        console.log("music is ", musicURL);
        console.log("GET_INFO: current userInfo", playerB, this.users[playerB].userName);
        console.log("GET_INFO: opponent userInfo", this.users[playerA].userId, this.users[playerA].userName);

        this.users[playerA].socket.emit(SOCKET_IDS.GET_BATTLE_INFO, {
          ...room,
          opponentUserId: playerB,
          opponentUserName: this.users[playerB].userName,
          opponentArtistName: this.users[playerB].userArtistName,
          opponentProfileURL: this.users[playerB].userProfileURL
        });

        this.users[playerB].socket.emit(SOCKET_IDS.GET_BATTLE_INFO, {
          ...room,
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
      if (!this.lobbyUserList.includes(userId)) {
        this.lobbyUserList.push(userId);
      } else {
        console.log('USER is already in the lobby now', userId);
      }
      console.log('next.lobbyUserList ', this.lobbyUserList, userId);
      // init data
      this.users[userId] = { socket, roomId: null, isStarted: false, isOnline: true, userId, userName, userProfileURL, userArtistName, enterLobbyTime };
      // set userId of this socket
      this.sockets[currentSocketId].userId = userId;
      socket.emit(SOCKET_IDS.WAIT_OPPONENT, 60000);
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
      const { userId, userName, userProfileURL, userArtistName } = data;
      console.log('userList ', this.lobbyUserList);
      console.log("connect is userInfo ", userId, userName);
      this.handleEnterLobby(socket, { userId, userName, userProfileURL, userArtistName });
    } catch (e) {
      console.log('handleConnect error is ', e);
    }
  }

  handleReConnect(socket, data) {
    try {
      const currentSocketId = socket.id;
      const { userId, userName, userProfileURL, userArtistName } = data;
      console.log("reconnect is userInfo ", userId, userName);
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
        const currentRoomId = userInfo.roomId;
        const roomInfo = this.rooms[currentRoomId];
        console.log("user is trying to join again", userId, userInfo.availableTime, currentRoomId);
        console.log("roomInfo join again", roomInfo.playerA, roomInfo.playerB);
        const opponentUserId = roomInfo.playerA == userId ? roomInfo.playerB : roomInfo.playerA;
        this.users[userId].socket = socket;
        this.users[userId].isOnline = true;
        // recover his prev roomInfo
        socket.emit(SOCKET_IDS.RECOVER, {
          ...roomInfo,
          playerA: roomInfo.playerA,
          playerB: roomInfo.playerB,
        });
        this.users[opponentUserId].socket.emit(SOCKET_IDS.CONTINUE, {});
      }
    } catch (e) {
      console.log('handleConnect error is ', e);
    }
  }

  handleLeave(socket, data) {
    try {
      // user lost his network, data is [], but user click the back button.
      const { userId } = data;
      console.log("disconnect param userId: ", userId);

      const currentSocketId = socket.id;
      const socketInfo = this.sockets[currentSocketId];
      if (!socketInfo) return;
      const currentUserId = this.sockets[currentSocketId].userId;
      const currentUserInfo = this.users[currentUserId];
      if (currentUserId && currentUserInfo) {
        currentUserInfo.isOnline = false;
        const currentTime = Math.floor(Date.now());
        currentUserInfo.availableTime = currentTime + 60 * 1000;
        const currentRoomId = currentUserId ? currentUserInfo.roomId : null;

        if (currentRoomId !== null) {
          console.log("leave currentRoomId is ", currentRoomId);
          const opponentUserId = this.rooms[currentRoomId].playerA == currentUserId ? this.rooms[currentRoomId].playerB : this.rooms[currentRoomId].playerA;
          console.log("leave opponentUserId is ", opponentUserId);
          if (this.users[opponentUserId] && this.users[opponentUserId]?.isOnline) {
            this.users[opponentUserId].socket.emit(SOCKET_IDS.OPPONENT_DISCONNECTED, {
              isLeave: true,
              time: 60000,
              opponentUserId: currentUserId,
              opponentUserName: currentUserInfo.userName,
              opponentProfileURL: currentUserInfo.userProfileURL
            });
          } else {
            // get out from room
            // this.handleQuit(socket);
          }
        } else {
          // delete this.users[currentUserId];
        }
      }
      // const indexUser = this.lobbyUserList.indexOf(currentUserId);
      // this.lobbyUserList.splice(indexUser, 1);
      delete this.sockets[currentSocketId];
    } catch (e) {
      console.log('handleDisconnect error is ', e);
    }
  }

  handleDisconnect(socket) {
    try {
      const currentSocketId = socket.id;
      const socketInfo = this.sockets[currentSocketId];
      if (!socketInfo) return;
      const currentUserId = this.sockets[currentSocketId].userId;
      const currentUserInfo = this.users[currentUserId];
      if (currentUserId && currentUserInfo) {
        currentUserInfo.isOnline = false;
        const currentTime = Math.floor(Date.now());
        currentUserInfo.availableTime = currentTime + 60 * 1000;
        const currentRoomId = currentUserId ? currentUserInfo.roomId : null;

        if (currentRoomId !== null) {
          console.log("disconnect currentRoomId is ", currentRoomId);
          const opponentUserId = this.rooms[currentRoomId].playerA == currentUserId ? this.rooms[currentRoomId].playerB : this.rooms[currentRoomId].playerA;
          console.log("disconnect opponentUserId is ", opponentUserId);
          if (this.users[opponentUserId] && this.users[opponentUserId]?.isOnline) {
            this.users[opponentUserId].socket.emit(SOCKET_IDS.OPPONENT_DISCONNECTED, {
              isLeave: false,
              time: 60000,
              opponentUserId: currentUserId,
              opponentUserName: currentUserInfo.userName,
              opponentProfileURL: currentUserInfo.userProfileURL
            });
          } else {
            // get out from room
            // this.handleQuit(socket);
          }
        } else {
          // delete this.users[currentUserId];
        }
      }
      // const indexUser = this.lobbyUserList.indexOf(currentUserId);
      // this.lobbyUserList.splice(indexUser, 1);
      delete this.sockets[currentSocketId];
    } catch (e) {
      console.log('handleDisconnect error is ', e);
    }
  }
}
module.exports = SocketHandler;