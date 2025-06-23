const fs = require('fs');
const path = require('path');

const jackpotPath = path.join(__dirname, 'jackpot.json');

const defaultJackpotState = {
    preJackpot: {
        tickets: [],
        ticketCost: 10,
        ticketsNeeded: 10,
        prizePool: 0,
    },
    mainJackpot: {
        tickets: [],
        prizePool: 1000,
        drawTime: null, // We can set this later
    },
};

function readJackpot() {
    try {
        const data = fs.readFileSync(jackpotPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return defaultJackpotState;
        }
        console.error('Error reading jackpot file:', error);
        return null;
    }
}

function writeJackpot(data) {
    try {
        fs.writeFileSync(jackpotPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing to jackpot file:', error);
    }
}

module.exports = { readJackpot, writeJackpot, defaultJackpotState }; 