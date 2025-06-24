const { EmbedBuilder } = require('discord.js');
const { getUser } = require('../data/database');

module.exports = {
    name: 'balance',
    description: '💰 Check your casino balance and account info',
    aliases: ['bal', 'money', 'wallet'],
    async execute(message, args) {
        const userId = message.author.id;
        const user = getUser(userId);
        
        // Calculate some stats
        const winRate = user.stats.gamesPlayed > 0 ? 
            ((user.stats.gamesWon / user.stats.gamesPlayed) * 100).toFixed(1) : 0;
        const netProfit = user.stats.totalWinnings - user.stats.totalLost;
        const accountAge = Math.floor((Date.now() - user.joinedAt) / (1000 * 60 * 60 * 24));

        // Create animated loading embed first
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 Loading Account Information...')
            .setDescription('```\n⠋ Accessing casino database...\n⠙ Calculating statistics...\n⠹ Preparing display...\n```')
            .setThumbnail(message.author.displayAvatarURL());

        const msg = await message.channel.send({ embeds: [loadingEmbed] });

        // Simulate loading time for animation effect
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Determine balance color and emoji
        let balanceColor = '#FF6B6B'; // Red for low balance
        let balanceEmoji = '💸';
        if (user.balance >= 10000) {
            balanceColor = '#FFD700'; // Gold for high balance
            balanceEmoji = '💰';
        } else if (user.balance >= 5000) {
            balanceColor = '#00FF7F'; // Green for good balance
            balanceEmoji = '💵';
        } else if (user.balance >= 1000) {
            balanceColor = '#87CEEB'; // Blue for decent balance
            balanceEmoji = '💳';
        }

        // Create main balance embed
        const balanceEmbed = new EmbedBuilder()
            .setColor(balanceColor)
            .setTitle(`${balanceEmoji} ${message.author.username}'s Casino Account`)
            .setDescription(`**Welcome back to the casino!** 🎰\n*Your account summary is ready*`)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                {
                    name: '💰 **Current Balance**',
                    value: `\`\`\`fix\n$${user.balance.toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '📊 **Win Rate**',
                    value: `\`\`\`${winRate}%\`\`\`\n*${user.stats.gamesWon}/${user.stats.gamesPlayed} games*`,
                    inline: true
                },
                {
                    name: '🏆 **Biggest Win**',
                    value: `\`\`\`fix\n$${user.stats.biggestWin.toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '📈 **Total Winnings**',
                    value: `$${user.stats.totalWinnings.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '📉 **Total Lost**',
                    value: `$${user.stats.totalLost.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '💎 **Net Profit**',
                    value: `${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '🎁 **Daily Streak**',
                    value: `${user.daily.streak} days`,
                    inline: true
                },
                {
                    name: '🎮 **Games Played**',
                    value: `${user.stats.gamesPlayed}`,
                    inline: true
                },
                {
                    name: '📅 **Account Age**',
                    value: `${accountAge} days`,
                    inline: true
                }
            )
            .setFooter({ 
                text: `🎰 ${user.balance < 100 ? 'Use $daily to get more money!' : 'Good luck in the casino!'} | Account ID: ${userId.slice(-4)}`,
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Add special messages based on balance
        if (user.balance === 0) {
            balanceEmbed.addFields({
                name: '🚨 **Account Alert**',
                value: '```fix\nYour balance is $0!\nUse $daily to get free money and start playing again!```',
                inline: false
            });
        } else if (user.balance >= 50000) {
            balanceEmbed.addFields({
                name: '👑 **High Roller Status**',
                value: '```fix\nCongratulations! You are a certified high roller!\nKeep up the amazing work!```',
                inline: false
            });
        }

        // Add loan information if user has loans
        if (user.loans.borrowed.length > 0 || user.loans.lent.length > 0) {
            let loanInfo = '';
            if (user.loans.borrowed.length > 0) {
                loanInfo += `💸 **Borrowed:** ${user.loans.borrowed.length} loan(s)\n`;
            }
            if (user.loans.lent.length > 0) {
                loanInfo += `💰 **Lent:** ${user.loans.lent.length} loan(s)\n`;
            }
            
            balanceEmbed.addFields({
                name: '🏦 **Loan Status**',
                value: loanInfo,
                inline: false
            });
        }

        await msg.edit({ embeds: [balanceEmbed] });
    }
}; 