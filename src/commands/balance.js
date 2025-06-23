const { readDb } = require('../data/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'balance',
    description: 'Check your account balance.',
    aliases: ['bal'],
    async execute(message, args) {
        const user = message.mentions.users.first() || message.author;
        const db = readDb();
        const balance = db.users[user.id] ? db.users[user.id].balance : 0;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`💰 ${user.username}'s Wallet 💰`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`💵 **$${balance.toLocaleString()}**`)
            .addFields(
                { name: '🏦 Bank Balance', value: `$${balance.toLocaleString()}`, inline: true },
                { name: '📊 Status', value: balance > 10000 ? '🤑 Rich' : balance > 1000 ? '💰 Comfortable' : '💸 Poor', inline: true }
            )
            .setFooter({ text: `💡 Tip: Use $daily to claim your daily reward!` });

        await message.channel.send({ embeds: [embed] });
    },
}; 