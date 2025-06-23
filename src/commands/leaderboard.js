const { EmbedBuilder } = require('discord.js');
const { readDb } = require('../data/database');

module.exports = {
    name: 'leaderboard',
    description: 'Displays the top 10 richest users.',
    aliases: ['lb', 'top'],
    async execute(message, args) {
        const db = readDb();
        const users = db.users;

        const sortedUsers = Object.entries(users)
            .sort(([, a], [, b]) => b.balance - a.balance)
            .slice(0, 10);

        const embed = new EmbedBuilder()
            .setTitle('🏆 Casino Leaderboard 🏆')
            .setColor('#FFD700')
            .setThumbnail('https://cdn.discordapp.com/emojis/741090681077211157.png');

        if (sortedUsers.length === 0) {
            embed.setDescription('🏜️ The leaderboard is currently empty.\n\nStart gambling to claim your spot!');
        } else {
            const medals = ['🥇', '🥈', '🥉'];
            const leaderboard = await Promise.all(sortedUsers.map(async ([id, data], index) => {
                try {
                    const user = await message.client.users.fetch(id);
                    const medal = medals[index] || `${index + 1}.`;
                    const crown = index === 0 ? '👑 ' : '';
                    return `${medal} ${crown}**${user.username}** - $${data.balance.toLocaleString()}`;
                } catch {
                    const medal = medals[index] || `${index + 1}.`;
                    return `${medal} **Unknown User** - $${data.balance.toLocaleString()}`;
                }
            }));
            embed.setDescription(leaderboard.join('\n'));
            embed.setFooter({ text: '💰 Keep gambling to climb the ranks!' });
        }

        await message.channel.send({ embeds: [embed] });
    },
}; 