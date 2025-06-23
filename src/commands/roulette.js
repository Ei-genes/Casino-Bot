const { readDb, writeDb } = require('../data/database');
const { EmbedBuilder } = require('discord.js');

const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

module.exports = {
    name: 'roulette',
    description: 'Play a game of roulette.',
    aliases: ['r'],
    async execute(message, args) {
        const space = args[0]?.toLowerCase();
        const bet = parseInt(args[1]);
        const userId = message.author.id;

        if (!space) {
            return message.reply('You must specify a space to bet on (e.g., "red", "black", or a number 0-36).');
        }
        if (isNaN(bet) || bet <= 0) {
            return message.reply('You must provide a valid positive amount to bet.');
        }
        
        const db = readDb();
        if (!db.users[userId] || !db.users[userId].stats) {
            db.users[userId] = { balance: 0, lastDaily: 0, stats: { played: 0, wins: 0, losses: 0 } };
        }
        
        if (db.users[userId].balance < bet) {
            return message.reply('You do not have enough money to make that bet.');
        }

        const winningNumber = Math.floor(Math.random() * 37);
        let winnings = 0;
        let resultMessage = '';

        const numberBet = parseInt(space);
        if (space === 'even' || space === 'odd') {
            if (winningNumber !== 0 && ((winningNumber % 2 === 0 && space === 'even') || (winningNumber % 2 !== 0 && space === 'odd'))) {
                winnings = bet * 2;
                resultMessage += `Congratulations! You bet on ${space} and won ${winnings}!`;
            } else {
                resultMessage += `Sorry, you lost your bet of ${bet}.`;
            }
        } else if (space === 'high' || space === 'low') {
            if (winningNumber >= 1 && winningNumber <= 18 && space === 'low' || winningNumber >= 19 && winningNumber <= 36 && space === 'high') {
                winnings = bet * 2;
                resultMessage += `Congratulations! You bet on ${space} and won ${winnings}!`;
            } else {
                resultMessage += `Sorry, you lost your bet of ${bet}.`;
            }
        } else if (!isNaN(numberBet) && numberBet >= 0 && numberBet <= 36) {
            if (numberBet === winningNumber) {
                winnings = bet * 35;
                resultMessage += `Congratulations! You bet on ${numberBet} and won ${winnings}!`;
            } else {
                resultMessage += `Sorry, you lost your bet of ${bet}.`;
            }
        } else if (space === 'red' || space === 'black') {
            const winningColor = getColor(winningNumber);
            if (space === winningColor) {
                winnings = bet * 2;
                resultMessage += `Congratulations! You bet on ${space} and won ${winnings}!`;
            } else {
                resultMessage += `Sorry, you lost your bet of ${bet}.`;
            }
        } else {
            return message.reply('Invalid space. Please bet on "red", "black", "even", "odd", "high", "low", or a number between 0 and 36.');
        }

        db.users[userId].stats.played++;
        if (winnings > 0) {
            db.users[userId].balance += winnings;
            db.users[userId].stats.wins++;
        } else {
            db.users[userId].balance -= bet;
            db.users[userId].stats.losses++;
        }
        writeDb(db);

        const embed = new EmbedBuilder()
            .setColor(winnings > 0 ? '#00FF00' : '#FF0000')
            .setTitle('🎲 Roulette 🎲')
            .setDescription(`The wheel landed on **${winningNumber} ${getColor(winningNumber)}**!`)
            .addFields(
                { name: 'Result', value: resultMessage },
                { name: 'New Balance', value: `> ${db.users[userId].balance} 💰` }
            );

        await message.channel.send({ embeds: [embed] });
    },
};

function getColor(number) {
    if (number === 0) return 'green';
    if (redNumbers.includes(number)) return 'red';
    return 'black';
} 