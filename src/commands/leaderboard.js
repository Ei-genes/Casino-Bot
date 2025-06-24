const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { readDb, updateLeaderboard } = require('../data/database');

module.exports = {
    name: 'leaderboard',
    description: '🏆 View the casino leaderboards',
    aliases: ['lb', 'top', 'rankings'],
    async execute(message, args) {
        // Update leaderboard data
        updateLeaderboard();
        const db = readDb();
        
        const categories = [
            {
                name: '💰 Richest Players',
                key: 'richest',
                description: 'Top players by current balance',
                emoji: '💰',
                color: '#FFD700'
            },
            {
                name: '💎 Biggest Wins',
                key: 'biggestWins',
                description: 'Largest single wins in casino history',
                emoji: '💎',
                color: '#FF6B35'
            },
            {
                name: '🎮 Most Active',
                key: 'mostPlayed',
                description: 'Players with most games played',
                emoji: '🎮',
                color: '#4ECDC4'
            }
        ];

        let currentCategory = 0;

        const createLeaderboardEmbed = async (categoryIndex) => {
            const category = categories[categoryIndex];
            const leaderboardData = db.leaderboard[category.key];
            
            const embed = new EmbedBuilder()
                .setColor(category.color)
                .setTitle(`🏆 **${category.name}** 🏆`)
                .setDescription(`**${category.description}**\n*Updated in real-time*`)
                .setThumbnail(message.guild?.iconURL() || null)
                .setFooter({ 
                    text: `🎰 Casino Leaderboards | Category ${categoryIndex + 1}/${categories.length}`,
                    iconURL: message.client.user.displayAvatarURL()
                })
                .setTimestamp();

            if (leaderboardData.length === 0) {
                embed.addFields({
                    name: '📝 **No Data Available**',
                    value: 'No players have been ranked in this category yet.\nStart playing to appear on the leaderboard!',
                    inline: false
                });
                return embed;
            }

            // Create leaderboard entries
            let leaderboardText = '';
            const medals = ['🥇', '🥈', '🥉'];
            
            for (let i = 0; i < Math.min(leaderboardData.length, 10); i++) {
                const entry = leaderboardData[i];
                const position = i + 1;
                const medal = i < 3 ? medals[i] : `**${position}.**`;
                
                try {
                    const user = await message.client.users.fetch(entry.id);
                    const username = user.username;
                    
                    let value = '';
                    if (category.key === 'richest') {
                        value = `$${entry.balance.toLocaleString()}`;
                    } else if (category.key === 'biggestWins') {
                        value = `$${entry.amount.toLocaleString()}`;
                    } else if (category.key === 'mostPlayed') {
                        value = `${entry.games} games`;
                    }
                    
                    leaderboardText += `${medal} **${username}** - ${value}\n`;
                } catch (error) {
                    // User not found, skip
                    continue;
                }
            }

            if (leaderboardText) {
                embed.addFields({
                    name: `${category.emoji} **Top Players**`,
                    value: leaderboardText,
                    inline: false
                });
            }

            // Add user's ranking if they're not in top 10
            const userRanking = leaderboardData.findIndex(entry => entry.id === message.author.id);
            if (userRanking !== -1 && userRanking >= 10) {
                let userValue = '';
                const userEntry = leaderboardData[userRanking];
                
                if (category.key === 'richest') {
                    userValue = `$${userEntry.balance.toLocaleString()}`;
                } else if (category.key === 'biggestWins') {
                    userValue = `$${userEntry.amount.toLocaleString()}`;
                } else if (category.key === 'mostPlayed') {
                    userValue = `${userEntry.games} games`;
                }

                embed.addFields({
                    name: '📍 **Your Ranking**',
                    value: `**#${userRanking + 1}** ${message.author.username} - ${userValue}`,
                    inline: false
                });
            } else if (userRanking === -1) {
                embed.addFields({
                    name: '📍 **Your Ranking**',
                    value: 'Not ranked yet - start playing to appear on the leaderboard!',
                    inline: false
                });
            }

            return embed;
        };

        const createButtons = () => {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('lb_prev')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === 0),
                    new ButtonBuilder()
                        .setCustomId('lb_refresh')
                        .setLabel('🔄 Refresh')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('lb_next')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentCategory === categories.length - 1)
                );
        };

        // Create loading embed
        const loadingEmbed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🏆 Loading Leaderboards...')
            .setDescription('```\n⠋ Fetching player data...\n⠙ Calculating rankings...\n⠹ Preparing display...\n```');

        const leaderboardMessage = await message.channel.send({ embeds: [loadingEmbed] });
        
        // Simulate loading
        await new Promise(resolve => setTimeout(resolve, 1500));

        const initialEmbed = await createLeaderboardEmbed(currentCategory);
        await leaderboardMessage.edit({
            embeds: [initialEmbed],
            components: [createButtons()]
        });

        const collector = leaderboardMessage.createMessageComponentCollector({
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({
                    content: '❌ You can only control your own leaderboard view!',
                    ephemeral: true
                });
            }

            if (interaction.customId === 'lb_prev' && currentCategory > 0) {
                currentCategory--;
            } else if (interaction.customId === 'lb_next' && currentCategory < categories.length - 1) {
                currentCategory++;
            } else if (interaction.customId === 'lb_refresh') {
                updateLeaderboard();
                // Category stays the same for refresh
            }

            const updatedEmbed = await createLeaderboardEmbed(currentCategory);
            await interaction.update({
                embeds: [updatedEmbed],
                components: [createButtons()]
            });
        });

        collector.on('end', () => {
            leaderboardMessage.edit({
                components: []
            }).catch(() => {});
        });
    }
}; 