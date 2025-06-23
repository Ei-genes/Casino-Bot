const { readDb, writeDb } = require('../data/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'dice',
    description: 'Roll a dice and win on 6.',
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

        const roll = Math.floor(Math.random() * 6) + 1;
        let resultMessage = '';

        db.users[userId].stats.played++;
        if (roll === 6) {
            const winnings = bet * 5;
            db.users[userId].balance += winnings;
            db.users[userId].stats.wins++;
            resultMessage += `Congratulations! You won **${winnings}**.`;
        } else {
            db.users[userId].balance -= bet;
            db.users[userId].stats.losses++;
            resultMessage += `Sorry, you lost **${bet}**.`;
        }
        writeDb(db);
        
        const embed = new EmbedBuilder()
            .setColor(roll === 6 ? '#00FF00' : '#FF0000')
            .setTitle('🎲 Dice Roll 🎲')
            .setDescription(`You rolled a **${roll}**!`)
            .addFields(
                { name: 'Result', value: resultMessage },
                { name: 'New Balance', value: `> ${db.users[userId].balance} 💰` }
            );

        await message.channel.send({ embeds: [embed] });
    },
}; 