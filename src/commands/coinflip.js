const { readDb, writeDb, checkOverdueLoans } = require('../data/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'coinflip',
    description: 'Bet on a coin flip.',
    aliases: ['cf'],
    async execute(message, args) {
        const choice = args[0]?.toLowerCase();
        const bet = parseInt(args[1]);
        const userId = message.author.id;

        // Check for overdue loans
        const loanCheck = checkOverdueLoans(userId);
        if (loanCheck.hasOverdueLoans) {
            const overdueLoan = loanCheck.overdueLoans[0];
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🚨 GAMES DISABLED 🚨')
                .setDescription('You have an overdue loan! All games are disabled until you repay it.')
                .addFields(
                    { name: '💸 Overdue Amount', value: `$${overdueLoan.repayment.toLocaleString()}`, inline: true },
                    { name: '🏦 Lender', value: `<@${overdueLoan.lenderId}>`, inline: true },
                    { name: '⏰ Overdue Since', value: new Date(overdueLoan.deadline).toLocaleString(), inline: false },
                    { name: '💰 How to Repay', value: 'Use `$daily` to earn money, then `$repay @lender`' }
                )
                .setFooter({ text: '🚨 Pay your debts to unlock games!' });
            return message.reply({ embeds: [embed] });
        }

        if (!['heads', 'tails'].includes(choice)) {
            return message.reply('You must choose "heads" or "tails".');
        }
        if (isNaN(bet) || bet <= 0) {
            return message.reply('You must provide a valid positive amount to bet.');
        }

        const db = readDb();
        if (!db.users[userId] || db.users[userId].balance < bet) {
            return message.reply('You do not have enough money to make that bet.');
        }

        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        let resultMessage = '';

        db.users[userId].stats.played++;
        if (result === choice) {
            db.users[userId].balance += bet;
            db.users[userId].stats.wins++;
            resultMessage += `Congratulations! You won **${bet}**.`;
        } else {
            db.users[userId].balance -= bet;
            db.users[userId].stats.losses++;
            resultMessage += `Sorry, you lost **${bet}**.`;
        }
        writeDb(db);
        
        const embed = new EmbedBuilder()
            .setColor(result === choice ? '#00FF00' : '#FF0000')
            .setTitle('🪙 Coinflip 🪙')
            .setDescription(`The coin landed on: **${result.charAt(0).toUpperCase() + result.slice(1)}**!`)
            .addFields(
                { name: 'Result', value: resultMessage },
                { name: 'New Balance', value: `> ${db.users[userId].balance} 💰` }
            );

        await message.channel.send({ embeds: [embed] });
    },
}; 