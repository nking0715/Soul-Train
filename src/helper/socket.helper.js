const musicList = [
    'https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Avion_FOR_BATTLE_V05.wav',
];

exports.selectRandomUser = (playerA, playerB) => {
    const users = [playerA, playerB];
    const randomIndex = Math.floor(Math.random() * 10 % users.length);
    return users[randomIndex];
};

exports.selectRandomMusic = () => {
    const randomIndex = Math.floor(Math.random() * 10 % musicList.length);
    return musicList[randomIndex];
};
