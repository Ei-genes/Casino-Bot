const { readDb, writeDb } = require('../data/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'transfer',
    description: 'Send money to another user.',
    aliases: ['give', 'pay'],
    async execute(message, args) {
        const recipient = message.mentions.users.first();
        const amount = parseInt(args[1]);
        const senderId = message.author.id;

        if (!recipient) {
            return message.reply('You must mention a user to transfer money to.');
        }
        if (recipient.bot) {
            return message.reply('You cannot transfer money to a bot.');
        }
        if (recipient.id === senderId) {
            return message.reply('You cannot transfer money to yourself.');
        }
        if (isNaN(amount) || amount <= 0) {
            return message.reply('You must provide a valid positive amount to transfer.');
        }

        const db = readDb();
        if (!db.users[senderId] || db.users[senderId].balance < amount) {
            return message.reply('You do not have enough money to make that transfer.');
        }

        if (!db.users[recipient.id]) {
            db.users[recipient.id] = { balance: 0, lastDaily: 0, stats: { played: 0, wins: 0, losses: 0 } };
        }

        db.users[senderId].balance -= amount;
        db.users[recipient.id].balance += amount;
        writeDb(db);

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('💸 Money Transfer')
            .setDescription(`Successfully transferred **$${amount.toLocaleString()}** to ${recipient.username}!`)
            .addFields(
                { name: 'From', value: `${message.author.username}`, inline: true },
                { name: 'To', value: `${recipient.username}`, inline: true },
                { name: 'Amount', value: `$${amount.toLocaleString()}`, inline: true },
                { name: 'Your New Balance', value: `$${db.users[senderId].balance.toLocaleString()}` }
            )
            .setThumbnail(recipient.displayAvatarURL());

        await message.channel.send({ embeds: [embed] });
    },
}; 