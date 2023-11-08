exports.selectRandomUser = (playerA, playerB) => {
    const users = [playerA, playerB];
    const randomIndex = Math.floor(Math.random() * 10 % users.length);
    return users[randomIndex];
};