                                                                                                                                                                                                                                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'help',
    description: '🎰 Display all casino commands with beautiful interface',
    aliases: ['h', 'commands'],
    async execute(message, args) {
        const pages = [
            {
                title: '🎰 CASINO GAMES 🎰',
                description: '**Welcome to the Ultimate Casino Experience!**\n*Click the buttons below to navigate through different categories*',
                fields: [
                    {
                        name: '🎰 **SLOT GAMES**',
                        value: '`$slots` - 🎰 Spin the slot machine for massive jackpots!\n`$dice` - 🎲 Roll dice and win guaranteed prizes',
                        inline: true
                    },
                    {
                        name: '🃏 **CARD GAMES**',
                        value: '`$blackjack` - 🃏 Beat the dealer in classic 21\n`$baccarat` - 🎴 Player vs Banker card battle\n`$war` - ⚔️ Highest card wins the war!',
                        inline: true
                    },
                    {
                        name: '🎯 **TABLE GAMES**',
                        value: '`$roulette` - 🎰 Bet on red, black, or numbers\n`$coinflip` - 🪙 Double or nothing coin toss\n`$wheel` - 🎪 Spin the Wheel of Fortune!\n`$plinko` - 🎯 Drop balls down the peg board',
                        inline: true
                    },
                    {
                                        name: '🎫 **LOTTERY & NUMBERS**',
                value: '`$lottery <number>` - 🎫 Pick a number 1-250 for the mega jackpot!\n`$crash` - 🚀 Cash out before the rocket crashes\n`$mines` - 💣 Navigate the minefield safely',
                        inline: true
                    },
                    {
                        name: '💰 **ECONOMY**',
                        value: '`$balance` - 💳 Check your casino balance\n`$daily` - 🎁 Claim your daily bonus\n`$transfer <@user> <amount>` - 💸 Send money to friends',
                        inline: false
                    }
                ],                          
                color: '#FFD700',
                thumbnail: '🎰'
            },
            {
                title: '💰 ECONOMY & BANKING 💰',
                description: '**Manage your casino finances like a pro!**',
                fields: [
                    {
                        name: '💳 **BALANCE & MONEY**',
                        value: '`$balance` - 💰 View your current balance\n`$daily` - 🎁 Claim $1,000 daily bonus (24h cooldown)\n`$transfer <@user> <amount>` - 💸 Send money to other players',
                        inline: false
                    },
                    {
                        name: '🏦 **LOANS & CREDIT**',
                        value: '`$loan <@user> <amount>` - 💰 Lend money to friends\n`$repay <@user>` - 💳 Pay back your loans\n`$credit` - 📊 View your loan status',
                        inline: false
                    },
                    {
                        name: '💡 **TIPS**',
                        value: '• Start with $1,000 free money!\n• Use daily bonus to build your bankroll\n• Loans have 10% interest and 24h deadline\n• Overdue loans BLOCK gambling (not daily)\n• Transfer money to help friends',
                        inline: false
                    }
                ],
                color: '#00FF7F',
                thumbnail: '💰'
            },
            {
                title: '📊 STATS & LEADERBOARDS 📊',
                description: '**Track your progress and compete with others!**',
                fields: [
                    {
                        name: '📈 **YOUR STATS**',
                        value: '`$stats` - 📊 View your detailed gaming statistics\n`$balance` - 💰 Check balance and recent activity',
                        inline: true
                    },
                    {
                        name: '🏆 **LEADERBOARDS**',
                        value: '`$leaderboard` - 🥇 Top players by balance\n`$top wins` - 💎 Biggest single wins\n`$top games` - 🎮 Most games played',
                        inline: true
                    },
                    {
                        name: '🎯 **ACHIEVEMENTS**',
                        value: '• First Win 🏆\n• High Roller 💎\n• Lucky Streak 🍀\n• Jackpot Winner 🎰\n• Daily Grinder ⚡',
                        inline: false
                    }
                ],
                color: '#9B59B6',
                thumbnail: '📊'
            }
        ];

        let currentPage = 0;
        
        const createEmbed = (page) => {
            const embed = new EmbedBuilder()
                .setColor(page.color)
                .setTitle(`${page.title}`)
                .setDescription(page.description)
                .setThumbnail(message.guild?.iconURL() || null)
                .setFooter({ 
                    text: `🎰 Casino Bot | Page ${currentPage + 1}/${pages.length} | Use buttons to navigate`,
                    iconURL: message.client.user.displayAvatarURL()
                })
                .setTimestamp();

            page.fields.forEach(field => {
                embed.addFields(field);
            });

            return embed;
        };

        const createButtons = () => {
            return new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('help_prev')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('help_home')
                        .setLabel('🏠 Home')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('help_next')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === pages.length - 1)
                );
        };

        const helpMessage = await message.channel.send({
            embeds: [createEmbed(pages[currentPage])],
            components: [createButtons()]
        });

        const collector = helpMessage.createMessageComponentCollector({
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({
                    content: '❌ You can only control your own help menu!',
                    ephemeral: true
                });
            }

            if (interaction.customId === 'help_prev' && currentPage > 0) {
                currentPage--;
            } else if (interaction.customId === 'help_next' && currentPage < pages.length - 1) {
                currentPage++;
            } else if (interaction.customId === 'help_home') {
                currentPage = 0;
            }

            await interaction.update({
                embeds: [createEmbed(pages[currentPage])],
                components: [createButtons()]
            });
        });

        collector.on('end', () => {
            helpMessage.edit({
                components: []
            }).catch(() => {});
        });
    }
}; 