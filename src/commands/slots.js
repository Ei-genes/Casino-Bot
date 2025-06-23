const { readDb, writeDb } = require('../data/database');
const { EmbedBuilder } = require('discord.js');

const symbols = ['🍒', '🍋', '🍊', '🍉', '🍇', '💎', '💰'];
// Payouts: 3 of a kind
const payouts = {
    '🍒': 5,
    '🍋': 8,
    '🍊': 10,
    '🍉': 15,
    '🍇': 20,
    '💎': 50,
    '💰': 100,
};

module.exports = {
    name: 'slots',
    description: 'Play the slot machine.',
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const userId = message.author.id;

        if (isNaN(bet) || bet <= 0) {
            return message.reply('You must provide a valid positive amount to bet.');
        }

        const db = readDb();
        if (!db.users[userId] || db.users[userId].balance < bet) {
            return message.reply('You do not have enough money to make that bet.');
        }

        const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
        const reel3 = symbols[Math.floor(Math.random() * symbols.length)];

        let winnings = 0;
        let resultText = '';

        db.users[userId].stats.played++;
        if (reel1 === reel2 && reel2 === reel3) {
            winnings = bet * payouts[reel1];
            db.users[userId].balance += winnings;
            db.users[userId].stats.wins++;
            resultText = `🎉 Jackpot! You won **${winnings}**! 🎉`;
        } else {
            db.users[userId].balance -= bet;
            db.users[userId].stats.losses++;
            resultText = `Sorry, you lost **${bet}**. Better luck next time!`;
        }
        writeDb(db);

        const embed = new EmbedBuilder()
            .setColor(winnings > 0 ? '#00FF00' : '#FF0000')
            .setTitle('🎰 Slot Machine 🎰')
            .setDescription(`[ ${reel1} | ${reel2} | ${reel3} ]`)
            .addFields(
                { name: 'Result', value: resultText },
                { name: 'New Balance', value: `> ${db.users[userId].balance} 💰` }
            );

        await message.channel.send({ embeds: [embed] });
    },
}; 