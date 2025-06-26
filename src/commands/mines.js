const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, readDb, writeDb } = require('../data/database');

const activeGames = new Map();

function createMineField(mines = 3) {
    const field = Array(25).fill(false); // 5x5 grid
    const minePositions = [];
    
    // Place mines randomly
    while (minePositions.length < mines) {
        const pos = Math.floor(Math.random() * 25);
        if (!minePositions.includes(pos)) {
            minePositions.push(pos);
            field[pos] = true;
        }
    }
    
    return { field, minePositions };
}

function calculateMultiplier(revealed, totalSafe, mines) {
    if (revealed === 0) return 1.0;
    
    // Progressive multiplier based on risk
    const baseMultiplier = 1.1;
    const riskFactor = mines / 25;
    const progressFactor = revealed / totalSafe;
    
    return parseFloat((baseMultiplier + (revealed * 0.3) + (riskFactor * revealed * 0.5)).toFixed(2));
}

function createGameEmbed(game, hit = false, cashOut = false) {
    const { bet, mines, revealed, currentMultiplier, gameOver } = game;
    
    let embedColor = '#FFD700'; // Gold while playing
    let title = '💣 **MINES GAME** 💣';
    let description = '';
    
    if (hit) {
        embedColor = '#FF4757'; // Red for mine hit
        title = '💥 **MINE HIT!** 💥';
        description = `💥 **BOOM! You hit a mine!**\n💸 **You lost $${bet.toLocaleString()}**`;
    } else if (cashOut) {
        embedColor = '#00FF7F'; // Green for cash out
        title = '💰 **CASHED OUT!** 💰';
        const winAmount = Math.floor(bet * currentMultiplier);
        description = `🎉 **Smart move! You cashed out safely!**\n💰 **You won $${winAmount.toLocaleString()}!**`;
    } else if (gameOver) {
        embedColor = '#9B59B6'; // Purple for perfect game
        title = '🏆 **PERFECT GAME!** 🏆';
        const winAmount = Math.floor(bet * currentMultiplier);
        description = `🎊 **INCREDIBLE! You found all safe tiles!**\n💎 **You won $${winAmount.toLocaleString()}!**`;
    } else {
        description = `💣 **Navigate the minefield carefully!**\n🎯 **Current multiplier: ${currentMultiplier}x**\n💰 **Potential win: $${Math.floor(bet * currentMultiplier).toLocaleString()}**`;
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
                name: '💣 **Mines**',
                value: `${mines} mines`,
                inline: true
            },
            {
                name: '📊 **Progress**',
                value: `${revealed}/${25 - mines} tiles revealed`,
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
            },
            {
                name: '💎 **Safe Tiles Left**',
                value: `${25 - mines - revealed}`,
                inline: true
            }
        )
        .setTimestamp();

    if (!hit && !cashOut && !gameOver) {
        embed.setFooter({ text: '💣 Click tiles to reveal them or cash out to secure your winnings!' });
    }
    
    return embed;
}

function createMineGrid(game, showAll = false) {
    const { field, revealedTiles, gameOver } = game;
    const components = [];
    
    // Create 5 rows of 5 buttons each
    for (let row = 0; row < 5; row++) {
        const actionRow = new ActionRowBuilder();
        
        for (let col = 0; col < 5; col++) {
            const index = row * 5 + col;
            const isRevealed = revealedTiles.includes(index);
            const isMine = field[index];
            
            let emoji = '⬜';
            let style = ButtonStyle.Secondary;
            let disabled = false;
            
            if (showAll || gameOver) {
                if (isMine) {
                    emoji = '💣';
                    style = ButtonStyle.Danger;
                } else if (isRevealed) {
                    emoji = '💎';
                    style = ButtonStyle.Success;
                } else {
                    emoji = '✅';
                    style = ButtonStyle.Success;
                }
                disabled = true;
            } else if (isRevealed) {
                emoji = '💎';
                style = ButtonStyle.Success;
                disabled = true;
            }
            
            const button = new ButtonBuilder()
                .setCustomId(`mine_${index}`)
                .setEmoji(emoji)
                .setStyle(style)
                .setDisabled(disabled);
                
            actionRow.addComponents(button);
        }
        
        components.push(actionRow);
    }
    
    // Add cash out button to the last row if game is active and player has revealed tiles
    if (!showAll && !gameOver && game.revealed > 0) {
        // Remove the last button from the last row to make space for cash out button
        const lastRow = components[4];
        lastRow.components.pop(); // Remove the last mine button (index 24)
        
        // Add cash out button to the last row
        const cashOutButton = new ButtonBuilder()
            .setCustomId('mine_cashout')
            .setLabel(`💰 Cash Out (${game.currentMultiplier}x)`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('💰');
            
        lastRow.addComponents(cashOutButton);
    }
    
    return components;
}

module.exports = {
    name: 'mines',
    description: '💣 Navigate the minefield and cash out before hitting a mine!',
    aliases: ['mine', 'minefield'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const mines = parseInt(args[1]) || 3; // Default 3 mines
        const userId = message.author.id;
        const user = getUser(userId);

        // Check if user already has an active game
        if (activeGames.has(userId)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💣 **Game In Progress**')
                .setDescription('**You already have an active Mines game!**')
                .setFooter({ text: '💣 Finish your current game first!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Input validation
        if (isNaN(bet) || bet <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💣 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$mines <amount> [mines]`', inline: true },
                    { name: '💡 **Example**', value: '`$mines 100 3`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '💣 Navigate the minefield for big wins!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (mines < 1 || mines > 20) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💣 **Invalid Mine Count**')
                .setDescription('**You must choose between 1-20 mines!**')
                .addFields(
                    { name: '⚠️ **Valid Range**', value: '1-20 mines', inline: true },
                    { name: '💡 **Recommended**', value: '3-5 mines for balanced gameplay', inline: true },
                    { name: '🎯 **Your Choice**', value: `${mines} mines`, inline: true }
                )
                .setFooter({ text: '💣 Choose 1-20 mines for your game!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to play Mines!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to play Mines!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Create game
        const { field, minePositions } = createMineField(mines);
        const gameId = `${userId}_${Date.now()}`;
        
        const game = {
            userId: userId,
            gameId: gameId,
            bet: bet,
            mines: mines,
            field: field,
            minePositions: minePositions,
            revealedTiles: [],
            revealed: 0,
            currentMultiplier: 1.0,
            gameOver: false
        };

        activeGames.set(userId, game);
        removeMoney(userId, bet);

        // Create initial game display
        const gameEmbed = createGameEmbed(game);
        const gridComponents = createMineGrid(game);
        
        const gameMessage = await message.channel.send({
            embeds: [gameEmbed],
            components: gridComponents
        });

        // Set up button collector
        const collector = gameMessage.createMessageComponentCollector({
            time: 300000, // 5 minutes
            filter: i => i.user.id === userId
        });

        collector.on('collect', async (interaction) => {
            try {
                const currentGame = activeGames.get(userId);
                if (!currentGame || currentGame.gameOver) {
                    return await interaction.reply({
                        content: '❌ Game not found or already ended!',
                        ephemeral: true
                    });
                }

                if (interaction.customId === 'mine_cashout') {
                    // Cash out
                    const winAmount = Math.floor(currentGame.bet * currentGame.currentMultiplier);
                    addMoney(userId, winAmount);
                    
                    // Update stats
                    const db = readDb();
                    db.users[userId].stats.gamesPlayed++;
                    db.users[userId].stats.gamesWon++;
                    if (winAmount > db.users[userId].stats.biggestWin) {
                        db.users[userId].stats.biggestWin = winAmount;
                    }
                    writeDb(db);

                    currentGame.gameOver = true;
                    const cashOutEmbed = createGameEmbed(currentGame, false, true);
                    cashOutEmbed.addFields({
                        name: '💳 **New Balance**',
                        value: `$${getUser(userId).balance.toLocaleString()}`,
                        inline: true
                    });
                    
                    const finalGrid = createMineGrid(currentGame, true);
                    
                    await interaction.update({
                        embeds: [cashOutEmbed],
                        components: finalGrid
                    });
                    
                    activeGames.delete(userId);
                    collector.stop();
                } else if (interaction.customId.startsWith('mine_')) {
                    // Tile reveal
                    const tileIndex = parseInt(interaction.customId.split('_')[1]);
                    
                    if (currentGame.revealedTiles.includes(tileIndex)) {
                        return await interaction.reply({
                            content: '❌ Tile already revealed!',
                            ephemeral: true
                        });
                    }
                    
                    currentGame.revealedTiles.push(tileIndex);
                    
                    // Check if mine hit
                    if (currentGame.field[tileIndex]) {
                        // Hit a mine - game over
                        currentGame.gameOver = true;
                        
                        // Update stats
                        const db = readDb();
                        db.users[userId].stats.gamesPlayed++;
                        writeDb(db);

                        const mineEmbed = createGameEmbed(currentGame, true);
                        mineEmbed.addFields({
                            name: '💳 **New Balance**',
                            value: `$${getUser(userId).balance.toLocaleString()}`,
                            inline: true
                        });
                        
                        const finalGrid = createMineGrid(currentGame, true);
                        
                        await interaction.update({
                            embeds: [mineEmbed],
                            components: finalGrid
                        });
                        
                        activeGames.delete(userId);
                        collector.stop();
                    } else {
                        // Safe tile
                        currentGame.revealed++;
                        currentGame.currentMultiplier = calculateMultiplier(
                            currentGame.revealed, 
                            25 - currentGame.mines, 
                            currentGame.mines
                        );
                        
                        // Check if all safe tiles revealed
                        if (currentGame.revealed === 25 - currentGame.mines) {
                            // Perfect game!
                            const winAmount = Math.floor(currentGame.bet * currentGame.currentMultiplier);
                            addMoney(userId, winAmount);
                            
                            // Update stats
                            const db = readDb();
                            db.users[userId].stats.gamesPlayed++;
                            db.users[userId].stats.gamesWon++;
                            if (winAmount > db.users[userId].stats.biggestWin) {
                                db.users[userId].stats.biggestWin = winAmount;
                            }
                            writeDb(db);

                            currentGame.gameOver = true;
                            const perfectEmbed = createGameEmbed(currentGame, false, false);
                            perfectEmbed.addFields({
                                name: '💳 **New Balance**',
                                value: `$${getUser(userId).balance.toLocaleString()}`,
                                inline: true
                            });
                            
                            const finalGrid = createMineGrid(currentGame, true);
                            
                            await interaction.update({
                                embeds: [perfectEmbed],
                                components: finalGrid
                            });
                            
                            activeGames.delete(userId);
                            collector.stop();
                        } else {
                            // Continue game
                            const updatedEmbed = createGameEmbed(currentGame);
                            const updatedGrid = createMineGrid(currentGame);
                            
                            await interaction.update({
                                embeds: [updatedEmbed],
                                components: updatedGrid
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Mines interaction error:', error);
                try {
                    if (!interaction.replied) {
                        await interaction.reply({
                            content: '❌ An error occurred while processing your action!',
                            ephemeral: true
                        });
                    }
                } catch (replyError) {
                    console.error('Failed to send error reply:', replyError);
                }
            }
        });

        collector.on('end', () => {
            if (activeGames.has(userId)) {
                activeGames.delete(userId);
            }
        });
    }
}; 