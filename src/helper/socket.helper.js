const musicList = [
    'https://soul-train-bucket.s3.amazonaws.com/Music/Oriental-02.wav',
    'https://soul-train-bucket.s3.amazonaws.com/Music/Falcons_Breaks_Drumline-02-2.wav',
    'https://soul-train-bucket.s3.amazonaws.com/Music/DJ_FLEG_Dimension_Five-02-2.wav',
    'https://soul-train-bucket.s3.amazonaws.com/Music/Dj_Arabinho_BOOM_BAP-02_2.wav',

    // 'https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Avion_FOR_BATTLE_V05.wav',
    // 'https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Dj+Arabinho+BOOM+BAP-_FOR_BATTLE_V05.wav',
    // 'https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_DJ+Mordecai+-+Nautilus+Chops-_FOR_BATTLE_V05.wav',
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_DJ+FLEG+-+06+We+Don't+Work+_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_DJ+Mordecai+-+Nautilus+Chops-_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Dj+Zapy+%26+Dj+Uragun+-+3+Rublya+Daj_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_djblesOne+-+04+Rich+Aliens-_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Falcons+Breaks+-+03+Drumline-_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Joey+Valence+-+Crank+It+Up+FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Joey+Valence+-+Underground+Sound+_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Oriental+Hurricane+Breaks-_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_Plasteed+-+Kreetical+-+05+Hit!-_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_PUNK_TACTICS_Joey_Valence_%26_Brae_Lyrics_FOR_BATTLE_V05.wav`,
    // `https://soul-train-bucket.s3.amazonaws.com/Music/FOR_BATTLE_V05_SoloGasRecordz+-+Uzee+Rock-_FOR_BATTLE_V05.wav`,
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
