const { EmbedBuilder } = require('discord.js');
const { readDb } = require('../data/database');

module.exports = {
    name: 'stats',
    description: 'View gambling statistics.',
    async execute(message, args) {
        const user = message.mentions.users.first() || message.author;

        const db = readDb();
        const userData = db.users[user.id];

        if (!userData) {
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('📊 No Statistics Found')
                .setDescription(`**${user.username}** has no gambling statistics yet.`)
                .addFields(
                    { name: '💡 Getting Started', value: 'Use `$daily` to get started with free coins!' },
                    { name: '🎲 Start Playing', value: 'Try games like `$coinflip`, `$dice`, or `$slots`!' }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: '🎰 Start gambling to build your stats!' });
            
            return message.reply({ embeds: [embed] });
        }

        const { played, wins, losses } = userData.stats;
        const winRate = played > 0 ? ((wins / played) * 100).toFixed(2) : 0;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📊 Gambling Stats for ${user.username} 📊`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '🎮 Games Played', value: `> ${played}`, inline: true },
                { name: '🏆 Wins', value: `> ${wins}`, inline: true },
                { name: '💸 Losses', value: `> ${losses}`, inline: true },
                { name: '📈 Win Rate', value: `> ${winRate}%`, inline: true },
                { name: '💰 Balance', value: `> $${userData.balance.toLocaleString()}`, inline: true },
                { name: '🎯 Performance', value: winRate >= 50 ? '🔥 Hot Streak!' : winRate >= 30 ? '⚡ Decent' : '🎲 Keep Trying!', inline: true }
            )
            .setFooter({ text: '🍀 Keep playing to improve your stats!' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    },
}; 