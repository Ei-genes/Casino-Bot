const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const lottoPath = path.join(__dirname, '../data/lotto.json');

function readLotto() {
    try {
        const data = fs.readFileSync(lottoPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { 
            totalTicketsSold: 0,
            totalPayout: 0,
            recentWinners: [],
            stats: {
                jackpots: 0,
                closeWins: 0,
                nearWins: 0,
                participationWins: 0
            }
        };
    }
}

module.exports = {
    name: 'lotto_pool',
    description: 'Show lottery statistics and recent winners.',
    aliases: ['lottopool', 'lottostats'],
    async execute(message, args) {
        const lotto = readLotto();
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎰 Instant Lottery Statistics 🎰')
            .setDescription('🎲 **Every ticket is an instant winner or loser!** 🎲\n\n🎯 The closer your number, the bigger the prize!')
            .addFields(
                { name: '🎫 Ticket Cost', value: '$100', inline: true },
                { name: '🔢 Number Range', value: '1-100', inline: true },
                { name: '⚡ Results', value: 'Instant!', inline: true },
                { name: '🎊 Jackpot Prize', value: '$50,000 (exact match)', inline: true },
                { name: '🔥 Close Prize', value: '$10,000 (±1 number)', inline: true },
                { name: '⚡ Near Prize', value: '$2,500 (±2-3 numbers)', inline: true },
                { name: '🎁 Consolation', value: '$150 (±4-10 numbers)', inline: true },
                { name: '💸 Loss', value: '$0 (±11+ numbers)', inline: true },
                { name: '📊 Total Tickets Sold', value: lotto.totalTicketsSold.toLocaleString(), inline: true }
            );

        // Add win statistics
        if (lotto.stats.jackpots > 0 || lotto.stats.closeWins > 0 || lotto.stats.nearWins > 0 || lotto.stats.participationWins > 0) {
            embed.addFields({
                name: '🏆 Win Statistics',
                value: `🎊 Jackpots: ${lotto.stats.jackpots}\n🔥 Close Wins: ${lotto.stats.closeWins}\n⚡ Near Wins: ${lotto.stats.nearWins}\n🎁 Consolation: ${lotto.stats.participationWins}\n💰 Total Paid: $${lotto.totalPayout.toLocaleString()}`,
                inline: false
            });
        }

        // Add recent winners
        if (lotto.recentWinners && lotto.recentWinners.length > 0) {
            const recentWinnersText = lotto.recentWinners.slice(0, 5).map((winner, index) => {
                const emoji = winner.type === 'jackpot' ? '🎊' : winner.type === 'close' ? '🔥' : winner.type === 'near' ? '⚡' : '🎁';
                const timeAgo = Math.floor((Date.now() - winner.timestamp) / (1000 * 60));
                return `${emoji} **${winner.username}** - $${winner.amount.toLocaleString()} (${timeAgo}m ago)`;
            }).join('\n');

            embed.addFields({
                name: '🎉 Recent Winners',
                value: recentWinnersText,
                inline: false
            });
        }

        embed.setFooter({ text: '🍀 Use $lotto <number> to play instantly!' });
        embed.setTimestamp();

        await message.channel.send({ embeds: [embed] });
    },
}; 