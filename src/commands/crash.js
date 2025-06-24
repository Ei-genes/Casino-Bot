const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, readDb, writeDb } = require('../data/database');

const activeGames = new Map();

function generateCrashPoint() {
    // Generate crash point with house edge
    const random = Math.random();
    if (random < 0.04) return 1.0; // 4% chance of instant crash
    if (random < 0.1) return 1.0 + Math.random() * 0.5; // 6% chance of early crash (1.0-1.5x)
    if (random < 0.3) return 1.5 + Math.random() * 1.5; // 20% chance of medium crash (1.5-3.0x)
    if (random < 0.7) return 3.0 + Math.random() * 7.0; // 40% chance of good run (3.0-10.0x)
    if (random < 0.95) return 10.0 + Math.random() * 40.0; // 25% chance of great run (10.0-50.0x)
    return 50.0 + Math.random() * 450.0; // 5% chance of epic run (50.0-500.0x)
}

function createClimbingEmbed(bet, currentMultiplier, crashed = false, crashPoint = null, cashedOut = false, cashOutMultiplier = null, user) {
    let embedColor = '#FFD700'; // Gold while climbing
    let title = '🚀 **CRASH GAME** 🚀';
    let description = '';
    
    if (crashed) {
        embedColor = '#FF4757'; // Red for crash
        title = '💥 **CRASHED!** 💥';
        if (cashedOut) {
            description = `🎉 **You cashed out at ${cashOutMultiplier}x just in time!**\n💥 **The rocket crashed at ${crashPoint}x**\n**You won $${Math.floor(bet * cashOutMultiplier).toLocaleString()}!**`;
        } else {
            description = `💥 **The rocket crashed at ${crashPoint}x!**\n**You lost $${bet.toLocaleString()}** - should have cashed out earlier!`;
        }
    } else if (cashedOut) {
        embedColor = '#00FF7F'; // Green for successful cash out
        title = '💰 **CASHED OUT!** 💰';
        description = `🎉 **Smart move! You cashed out at ${currentMultiplier}x**\n**You won $${Math.floor(bet * currentMultiplier).toLocaleString()}!**`;
    } else {
        description = `🚀 **The rocket is climbing!**\n**Current multiplier: ${currentMultiplier}x**\n**Potential win: $${Math.floor(bet * currentMultiplier).toLocaleString()}**`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setDescription(description)
        .addFields(
            {
                name: '💰 **Your Bet**',
                value: `$${bet.toLocaleString()}`,
                inline: true
            },
            {
                name: '📈 **Current Multiplier**',
                value: `**${currentMultiplier}x**`,
                inline: true
            },
            {
                name: '🎯 **Potential Win**',
                value: `$${Math.floor(bet * currentMultiplier).toLocaleString()}`,
                inline: true
            }
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

    if (!crashed && !cashedOut) {
        embed.setFooter({ text: '🚀 Click "Cash Out" before the rocket crashes!' });
        
        // Add visual rocket trajectory
        let rocketTrail = '';
        const stages = Math.min(Math.floor(currentMultiplier), 10);
        for (let i = 0; i < stages; i++) {
            rocketTrail += '🔥';
        }
        rocketTrail += '🚀';
        
        embed.addFields({
            name: '🚀 **Rocket Trajectory**',
            value: rocketTrail + '\n' + '━'.repeat(Math.min(stages + 1, 20)),
            inline: false
        });
    }
    
    return embed;
}

function createButtons(gameId, cashedOut = false, crashed = false) {
    if (cashedOut || crashed) return [];
    
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`crash_cashout_${gameId}`)
                .setLabel('💰 Cash Out')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💰')
        );
}

module.exports = {
    name: 'crash',
    description: '🚀 Ride the rocket and cash out before it crashes!',
    aliases: ['rocket', 'moon'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const userId = message.author.id;
        const user = getUser(userId);

        // Check if user already has an active game
        if (activeGames.has(userId)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🚀 **Game In Progress**')
                .setDescription('**You already have an active Crash game!**')
                .setFooter({ text: '🚀 Cash out or wait for your current rocket!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Input validation
        if (isNaN(bet) || bet <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🚀 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$crash <amount>`', inline: true },
                    { name: '💡 **Example**', value: '`$crash 100`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🚀 Bet on the rocket and cash out before it crashes!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to play Crash!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to ride the rocket!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Generate crash point
        const crashPoint = generateCrashPoint();
        const gameId = `${userId}_${Date.now()}`;
        
        const game = {
            userId: userId,
            bet: bet,
            crashPoint: crashPoint,
            cashedOut: false,
            cashOutMultiplier: null,
            startTime: Date.now()
        };

        activeGames.set(userId, game);
        removeMoney(userId, bet);

        // Create initial embed
        let currentMultiplier = 1.0;
        const gameEmbed = createClimbingEmbed(bet, currentMultiplier, false, null, false, null, message.author);
        const buttons = createButtons(gameId);
        
        const gameMessage = await message.channel.send({
            embeds: [gameEmbed],
            components: [buttons]
        });

        // Set up button collector
        const collector = gameMessage.createMessageComponentCollector({
            time: 60000 // 1 minute max
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== userId) {
                return interaction.reply({
                    content: '❌ This is not your rocket!',
                    ephemeral: true
                });
            }

            const currentGame = activeGames.get(userId);
            if (!currentGame || currentGame.cashedOut) {
                return interaction.reply({
                    content: '❌ Game not found or already cashed out!',
                    ephemeral: true
                });
            }

            if (interaction.customId.startsWith('crash_cashout_')) {
                // Calculate current multiplier based on time elapsed
                const timeElapsed = Date.now() - currentGame.startTime;
                const currentMult = Math.min(1.0 + (timeElapsed / 1000) * 0.5, currentGame.crashPoint - 0.01);
                
                // Cash out
                currentGame.cashedOut = true;
                currentGame.cashOutMultiplier = parseFloat(currentMult.toFixed(2));
                
                const winAmount = Math.floor(bet * currentGame.cashOutMultiplier);
                addMoney(userId, winAmount);
                
                // Update stats
                const db = readDb();
                db.users[userId].stats.gamesPlayed++;
                db.users[userId].stats.gamesWon++;
                if (winAmount > db.users[userId].stats.biggestWin) {
                    db.users[userId].stats.biggestWin = winAmount;
                }
                writeDb(db);

                const cashOutEmbed = createClimbingEmbed(bet, currentGame.cashOutMultiplier, false, null, true, currentGame.cashOutMultiplier, message.author);
                cashOutEmbed.addFields({
                    name: '💳 **New Balance**',
                    value: `$${getUser(userId).balance.toLocaleString()}`,
                    inline: true
                });
                
                await interaction.update({
                    embeds: [cashOutEmbed],
                    components: []
                });
                
                activeGames.delete(userId);
                collector.stop();
            }
        });

        // Animate the rocket climbing
        const climbInterval = setInterval(async () => {
            if (!activeGames.has(userId)) {
                clearInterval(climbInterval);
                return;
            }

            const currentGame = activeGames.get(userId);
            if (currentGame.cashedOut) {
                clearInterval(climbInterval);
                return;
            }

            const timeElapsed = Date.now() - currentGame.startTime;
            currentMultiplier = 1.0 + (timeElapsed / 1000) * 0.5;

            // Check if crashed
            if (currentMultiplier >= currentGame.crashPoint) {
                clearInterval(climbInterval);
                
                // Update stats for loss
                const db = readDb();
                db.users[userId].stats.gamesPlayed++;
                writeDb(db);

                const crashEmbed = createClimbingEmbed(bet, currentGame.crashPoint, true, currentGame.crashPoint, false, null, message.author);
                crashEmbed.addFields({
                    name: '💳 **New Balance**',
                    value: `$${getUser(userId).balance.toLocaleString()}`,
                    inline: true
                });
                
                await gameMessage.edit({
                    embeds: [crashEmbed],
                    components: []
                });
                
                activeGames.delete(userId);
                collector.stop();
                return;
            }

            // Update embed with new multiplier
            const updatedEmbed = createClimbingEmbed(bet, parseFloat(currentMultiplier.toFixed(2)), false, null, false, null, message.author);
            const updatedButtons = createButtons(gameId);
            
            try {
                await gameMessage.edit({
                    embeds: [updatedEmbed],
                    components: [updatedButtons]
                });
            } catch (error) {
                clearInterval(climbInterval);
                activeGames.delete(userId);
            }
        }, 1000); // Update every second

        collector.on('end', () => {
            clearInterval(climbInterval);
            if (activeGames.has(userId)) {
                activeGames.delete(userId);
            }
        });
    }
}; 