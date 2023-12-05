const musicList = [
    'https://soul-train-bucket.s3.amazonaws.com/Music/Avion_02.wav',
    'https://soul-train-bucket.s3.amazonaws.com/Music/Dj_Arabinho_BOOM_BAP-02.wav',
    'https://soul-train-bucket.s3.amazonaws.com/Music/Oriental-02.wav',
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
