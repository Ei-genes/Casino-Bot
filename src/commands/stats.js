const { EmbedBuilder } = require('discord.js');
const { getUser, getJackpot } = require('../data/database');

module.exports = {
    name: 'stats',
    description: '📊 View your detailed casino statistics',
    aliases: ['statistics', 'profile'],
    async execute(message, args) {
        const userId = message.author.id;
        const user = getUser(userId);
        const jackpot = getJackpot();

        // Calculate advanced stats
        const winRate = user.stats.gamesPlayed > 0 ? 
            ((user.stats.gamesWon / user.stats.gamesPlayed) * 100).toFixed(1) : 0;
        const netProfit = user.stats.totalWinnings - user.stats.totalLost;
        const accountAge = Math.floor((Date.now() - user.joinedAt) / (1000 * 60 * 60 * 24));
        const averageWin = user.stats.gamesWon > 0 ? 
            Math.floor(user.stats.totalWinnings / user.stats.gamesWon) : 0;
        const averageLoss = (user.stats.gamesPlayed - user.stats.gamesWon) > 0 ? 
            Math.floor(user.stats.totalLost / (user.stats.gamesPlayed - user.stats.gamesWon)) : 0;

        // Create loading animation
        const loadingEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('📊 Loading Your Statistics...')
            .setDescription('```\n⠋ Analyzing game history...\n⠙ Calculating win rates...\n⠹ Preparing detailed report...\n```')
            .setThumbnail(message.author.displayAvatarURL());

        const msg = await message.channel.send({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Determine rank based on balance
        let rank = '🥉 Bronze';
        let rankColor = '#CD7F32';
        if (user.balance >= 100000) {
            rank = '💎 Diamond';
            rankColor = '#B9F2FF';
        } else if (user.balance >= 50000) {
            rank = '🏆 Platinum';
            rankColor = '#E5E4E2';
        } else if (user.balance >= 25000) {
            rank = '🥇 Gold';
            rankColor = '#FFD700';
        } else if (user.balance >= 10000) {
            rank = '🥈 Silver';
            rankColor = '#C0C0C0';
        }

        // Create performance bar
        const createProgressBar = (current, max, length = 10) => {
            const percentage = Math.min(current / max, 1);
            const filled = Math.floor(percentage * length);
            const empty = length - filled;
            return '█'.repeat(filled) + '░'.repeat(empty);
        };

        const statsEmbed = new EmbedBuilder()
            .setColor(rankColor)
            .setTitle(`📊 ${message.author.username}'s Casino Statistics`)
            .setDescription(`**${rank} Player** 🎰\n*Detailed performance analysis*`)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                {
                    name: '💰 **Financial Overview**',
                    value: `**Balance:** $${user.balance.toLocaleString()}\n**Net Profit:** ${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString()}\n**Biggest Win:** $${user.stats.biggestWin.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '🎮 **Game Statistics**',
                    value: `**Games Played:** ${user.stats.gamesPlayed}\n**Games Won:** ${user.stats.gamesWon}\n**Win Rate:** ${winRate}%`,
                    inline: true
                },
                {
                    name: '📈 **Performance**',
                    value: `**Total Winnings:** $${user.stats.totalWinnings.toLocaleString()}\n**Total Lost:** $${user.stats.totalLost.toLocaleString()}\n**Current Streak:** ${user.stats.currentStreak}`,
                    inline: true
                },
                {
                    name: '📊 **Win Rate Visualization**',
                    value: `\`\`\`${createProgressBar(user.stats.gamesWon, user.stats.gamesPlayed, 15)} ${winRate}%\`\`\``,
                    inline: false
                },
                {
                    name: '💡 **Average Performance**',
                    value: `**Average Win:** $${averageWin.toLocaleString()}\n**Average Loss:** $${averageLoss.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '🎁 **Daily Bonus**',
                    value: `**Current Streak:** ${user.daily.streak} days\n**Last Claim:** ${user.daily.lastClaim > 0 ? new Date(user.daily.lastClaim).toLocaleDateString() : 'Never'}`,
                    inline: true
                },
                {
                    name: '📅 **Account Info**',
                    value: `**Account Age:** ${accountAge} days\n**Member Since:** ${new Date(user.joinedAt).toLocaleDateString()}`,
                    inline: true
                }
            )
            .setFooter({ 
                text: `🎰 Current Jackpot: $${jackpot.toLocaleString()} | Keep playing to improve your stats!`,
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Add special achievements section
        let achievements = [];
        if (user.stats.biggestWin >= 10000) achievements.push('💎 High Roller');
        if (user.stats.gamesWon >= 100) achievements.push('🏆 Veteran Player');
        if (user.daily.streak >= 7) achievements.push('🔥 Daily Grinder');
        if (winRate >= 60) achievements.push('🎯 Lucky Player');
        if (user.balance >= 50000) achievements.push('👑 Wealthy');
        if (user.stats.gamesPlayed >= 500) achievements.push('🎮 Dedicated Gamer');

        if (achievements.length > 0) {
            statsEmbed.addFields({
                name: '🏅 **Achievements Unlocked**',
                value: achievements.join('\n'),
                inline: false
            });
        }

        // Add rank progression
        let nextRankInfo = '';
        if (user.balance < 10000) {
            nextRankInfo = `**Next Rank:** 🥈 Silver ($${(10000 - user.balance).toLocaleString()} needed)`;
        } else if (user.balance < 25000) {
            nextRankInfo = `**Next Rank:** 🥇 Gold ($${(25000 - user.balance).toLocaleString()} needed)`;
        } else if (user.balance < 50000) {
            nextRankInfo = `**Next Rank:** 🏆 Platinum ($${(50000 - user.balance).toLocaleString()} needed)`;
        } else if (user.balance < 100000) {
            nextRankInfo = `**Next Rank:** 💎 Diamond ($${(100000 - user.balance).toLocaleString()} needed)`;
        } else {
            nextRankInfo = '**You\'ve reached the highest rank!** 🏆';
        }

        statsEmbed.addFields({
            name: '🎯 **Rank Progress**',
            value: nextRankInfo,
            inline: false
        });

        await msg.edit({ embeds: [statsEmbed] });
    }
}; 