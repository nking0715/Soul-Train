const socket = io('http://localhost:3000/');


// this is frontend side for socket game app
let countdownInterval = {};
let countdownIntervalForLost = {};

socket.on(SOCKET_PROC.QUIT_SUCCESS, (data) => {
  document.getElementById("game").innerHTML = "";
  const timerElement = document.getElementById('timer');
  timerElement.innerText = ``;
  clearInterval(countdownInterval);
})

socket.on(SOCKET_PROC.OPPONENT_DISCONNECTED, (data) => {
  let time = data.time;
  countdownIntervalForLost = setInterval(() => {
    const timerElement = document.getElementById('timer');

    timerElement.innerText = `Opponent lost the network: ${time / 1000} seconds`;
    if (time <= 0) {
      clearInterval(countdownIntervalForLost); // Stop the countdown when time reaches 0
      timerElement.innerText = 'Do you want to play the match continue?';
    } else {
      time -= 1000;
    }
  }, 1000);

});

const enter = () => {
  const userId = document.getElementById("input").value;
  socket.emit(SOCKET_PROC.CONNECT, { userId, userName: 'bury', userProfileURL: 'ddasdf' });

  // find the prev room info
  socket.on(SOCKET_PROC.RECOVER, (data) => {
    const timerElement = document.getElementById('timer');
    timerElement.innerText = `play the battle`;
    createGame(data);
  });

  // game continue
  socket.on(SOCKET_PROC.CONTINUE, (data) => {
    const timerElement = document.getElementById('timer');
    clearInterval(countdownIntervalForLost); // Stop the countdown when time reaches 0
    timerElement.innerText = 'Opponent has restored the network';
  });



  socket.on(SOCKET_PROC.WAIT_OPPONENT, (remainingTime) => {
    console.log(`Remaining Time: ${remainingTime} seconds`);
    const timerElement = document.getElementById('timer');

    let time = remainingTime;
    countdownInterval = setInterval(() => {
      timerElement.innerText = `Remaining Time: ${time / 1000} seconds`;
      if (time <= 0) {
        clearInterval(countdownInterval); // Stop the countdown when time reaches 0
        timerElement.innerText = 'Do you want to look a opponent continue?';
      } else {
        time -= 1000;
      }
    }, 1000);
  });


  socket.on(SOCKET_PROC.GET_BATTLE_INFO, (data) => {
    clearInterval(countdownInterval);

    const starterElement = document.getElementById('starter');
    const timerElement = document.getElementById('timer');
    timerElement.innerText = `play the battle`;
    starterElement.innerText = `${data.starter} will start first`;
    createGame(data);
  })
}