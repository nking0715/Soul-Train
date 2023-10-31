class BattlePerformance {
    constructor() {
        this.playerA = null;
        this.playerB = null;
        this.performances = [];
    }

    newPerformance(data) {
        this.performances.push(data);
    }

    setPlayerA(socket) {
        this.playerA = socket;
    }

    setPlayerB(socket) {
        this.playerB = socket;
    }
}

module.exports = BattlePerformance;