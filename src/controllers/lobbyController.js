const isEmpty = require('../utils/isEmpty');
const Player = require('../models/player');
const socketManager = require('../utils/socket');

exports.joinLobby = async (req, res) => {
    const userId = req.user.id;
    const player = new Player({ playerInLobby: userId, entranceTime: Date.now() });
    await player.save();
    const players = await Player.find();
    const numberOfPlayers = players.length;
    if (numberOfPlayers == 1) {
        const loopToMatch = async () => {
            const players = await Player.find();
            const numberOfPlayers = players.length;
            if (numberOfPlayers > 1) {
                if (numberOfPlayers % 2 == 0) {
                    const pairs = createPairs(players);
                    const matches = createMatches(pairs);
                    if (matches) {
                        await Player.deleteMany({});
                        const io = socketManager.getIO();
                        io.emit('match-making', {
                            matches
                        });
                        clearInterval(intervalID);
                    }
                } else {
                    const sortedPlayers = [...players].sort((a, b) => b.entranceTime - a.entranceTime);
                    const latest = sortedPlayers[0];
                    const pairs = createPairs(players.filter(player => player._id !== latest._id));
                    const matches = createMatches(pairs);
                    if (matches) {
                        await Player.deleteMany({ _id: { $ne: latest._id } });
                        const io = socketManager.getIO();
                        io.emit('match-making', {
                            matches
                        });
                    }
                }
            } else {
                if (numberOfPlayers == 0) {
                    clearInterval(intervalID);
                } else {
                    const soloPlayer = await Player.findOne();
                    if ((Date.now() - soloPlayer.entranceTime) > 30000) {
                        await Player.deleteMany({});
                        clearInterval(intervalID);
                    }
                }
            }
        }
        let intervalID = setInterval(loopToMatch, 1000);
    }
};

const shuffleArray = (arr) => {
    let arrayCopy = [...arr];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
}

const createPairs = (arr) => {
    const shuffled = shuffleArray(arr);
    const pairs = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        pairs.push([shuffled[i], shuffled[i + 1]]);
    }
    return pairs;
}

const createMatches = (pairs) => {
    
}