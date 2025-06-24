const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, readDb, writeDb } = require('../data/database');

// Plinko board multipliers (left to right)
const multipliers = [0.2, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0, 5.0, 3.0, 2.0, 1.5, 1.0, 0.5, 0.2];
const multiplierColors = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🌟', '💎', '🌟', '🟣', '🔵', '🟢', '🟡', '🟠', '🔴'];

function createDroppingEmbed(stage, bet, ballPosition = null) {
    const dropStages = [
        { emoji: '🎯', text: 'Loading the Plinko board...' },
        { emoji: '⚪', text: 'Dropping the ball...' },
        { emoji: '🔄', text: 'Ball bouncing off pegs...' },
        { emoji: '⚡', text: 'Ball finding its path...' },
        { emoji: '🎪', text: 'Ball approaching bottom...' },
        { emoji: '🎊', text: 'Calculating your prize...' }
    ];

    const currentStage = dropStages[stage];
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎯 **PLINKO GAME** 🎯')
        .setDescription(`**Welcome to the Plinko Board!**\n\n${currentStage.emoji} ${currentStage.text}`)
        .addFields(
            { name: '💰 **Your Bet**', value: `$${bet.toLocaleString()}`, inline: true },
            { name: '🎯 **Game Type**', value: 'Classic Plinko', inline: true },
            { name: '🎲 **Max Multiplier**', value: '10x', inline: true }
        );

    if (ballPosition !== null) {
        embed.addFields({
            name: '⚪ **Ball Position**',
            value: `Currently at position ${ballPosition + 1}/15`,
            inline: false
        });
    }

    // Add visual plinko board
    embed.addFields({
        name: '🎯 **Plinko Board**',
        value: createPlinkoBoard(ballPosition),
        inline: false
    });

    embed.setFooter({ text: '🎯 Watch your ball bounce through the pegs!' });
    
    return embed;
}

function createPlinkoBoard(ballPosition = null) {
    let board = '```\n';
    
    // Top of board
    board += '        ⚪\n';
    board += '       / \\\n';
    
    // Peg rows
    const pegRows = [
        '      ● ● ●',
        '     ● ● ● ●',
        '    ● ● ● ● ●',
        '   ● ● ● ● ● ●',
        '  ● ● ● ● ● ● ●'
    ];
    
    pegRows.forEach(row => {
        board += row + '\n';
    });
    
    // Bottom multipliers
    board += '\n';
    board += '0.2 0.5 1.0 1.5 2.0 3.0 5.0 10x 5.0 3.0 2.0 1.5 1.0 0.5 0.2\n';
    
    if (ballPosition !== null) {
        let indicator = '';
        for (let i = 0; i < 15; i++) {
            if (i === ballPosition) {
                indicator += ' ⚪ ';
            } else {
                indicator += '   ';
            }
        }
        board += indicator + '\n';
    }
    
    board += '```';
    return board;
}

function createResultEmbed(bet, finalPosition, multiplier, winAmount, newBalance, user) {
    const isWin = winAmount > bet;
    const isLoss = winAmount < bet;
    
    let embedColor = '#FFD700'; // Gold for break even
    let title = '🎯 **PLINKO RESULT** 🎯';
    let description = '';
    
    if (isWin) {
        embedColor = '#00FF7F'; // Green for win
        title = '🎉 **PLINKO WIN!** 🎉';
        description = `🎊 **Your ball landed on ${multiplier}x!** 🎊\n**You won $${winAmount.toLocaleString()}!**`;
    } else if (isLoss) {
        embedColor = '#FF4757'; // Red for loss
        title = '💸 **PLINKO RESULT** 💸';
        description = `💸 **Your ball landed on ${multiplier}x** 💸\n**You lost $${(bet - winAmount).toLocaleString()}.**`;
    } else {
        description = `🤝 **Your ball landed on ${multiplier}x!**\n**You broke even - no gain, no loss!**`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setDescription(description)
        .addFields(
            {
                name: '🎯 **Landing Position**',
                value: `Position ${finalPosition + 1}/15\n${multiplierColors[finalPosition]} **${multiplier}x**`,
                inline: true
            },
            {
                name: '💰 **Bet Amount**',
                value: `$${bet.toLocaleString()}`,
                inline: true
            },
            {
                name: '🏆 **Winnings**',
                value: `$${winAmount.toLocaleString()}`,
                inline: true
            },
            {
                name: '📊 **Multiplier**',
                value: `**${multiplier}x**`,
                inline: true
            },
            {
                name: '💳 **New Balance**',
                value: `$${newBalance.toLocaleString()}`,
                inline: true
            },
            {
                name: '📈 **Result**',
                value: isWin ? '🎉 **PROFIT!**' : isLoss ? '💸 **LOSS**' : '🤝 **BREAK EVEN**',
                inline: true
            }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ 
            text: isWin ? '🎉 Great drop! Try again for more!' : '🎯 Drop another ball and try your luck!',
        })
        .setTimestamp();

    // Add payout table
    embed.addFields({
        name: '🎯 **Plinko Multipliers**',
        value: '**💎 10x** - Center jackpot!\n**🌟 5x** - Near center\n**🟣 3x** - Good zones\n**🔵 2x** - Safe zones\n**🟡 1x** - Break even\n**🔴 0.2x** - Edge zones',
        inline: false
    });

    // Add final board state
    embed.addFields({
        name: '🎯 **Final Board**',
        value: createPlinkoBoard(finalPosition),
        inline: false
    });

    return embed;
}

function simulatePlinkoPath() {
    // Simulate realistic plinko physics
    let position = 7; // Start at center (index 7 of 15 positions)
    
    // Each row, ball can go left or right with some randomness
    for (let row = 0; row < 8; row++) {
        const random = Math.random();
        
        // Bias towards center (bell curve distribution)
        if (random < 0.1) {
            position -= 2; // Strong left
        } else if (random < 0.3) {
            position -= 1; // Left
        } else if (random < 0.7) {
            // Stay roughly same (center bias)
        } else if (random < 0.9) {
            position += 1; // Right
        } else {
            position += 2; // Strong right
        }
        
        // Keep within bounds
        position = Math.max(0, Math.min(14, position));
        
        // Add some randomness for each peg hit
        if (Math.random() < 0.3) {
            position += Math.random() < 0.5 ? -1 : 1;
            position = Math.max(0, Math.min(14, position));
        }
    }
    
    return position;
}

module.exports = {
    name: 'plinko',
    description: '🎯 Drop a ball down the Plinko board for prizes!',
    aliases: ['drop', 'ball'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const userId = message.author.id;
        const user = getUser(userId);

        // Input validation
        if (isNaN(bet) || bet <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🎯 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$plinko <amount>`', inline: true },
                    { name: '💡 **Example**', value: '`$plinko 100`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🎯 Drop your ball down the Plinko board!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to play Plinko!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to play Plinko!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Start dropping animation
        const dropMessage = await message.channel.send({ 
            embeds: [createDroppingEmbed(0, bet)] 
        });
        
        // Animate the dropping process
        for (let i = 1; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await dropMessage.edit({ 
                embeds: [createDroppingEmbed(i, bet)] 
            });
        }

        // Simulate ball path and get final position
        const finalPosition = simulatePlinkoPath();
        const multiplier = multipliers[finalPosition];
        const winAmount = Math.floor(bet * multiplier);
        
        // Process bet
        removeMoney(userId, bet);
        addMoney(userId, winAmount);

        // Update stats
        const db = readDb();
        db.users[userId].stats.gamesPlayed++;
        if (winAmount > bet) {
            db.users[userId].stats.gamesWon++;
            if (winAmount > db.users[userId].stats.biggestWin) {
                db.users[userId].stats.biggestWin = winAmount;
            }
        }
        writeDb(db);

        // Show final result
        await new Promise(resolve => setTimeout(resolve, 2000));
        const updatedUser = getUser(userId);
        const resultEmbed = createResultEmbed(bet, finalPosition, multiplier, winAmount, updatedUser.balance, message.author);
        await dropMessage.edit({ embeds: [resultEmbed] });
    }
}; 