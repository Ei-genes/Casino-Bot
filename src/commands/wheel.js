const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, contributeLotteryFromBet, readDb, writeDb, isBlockedFromGambling } = require('../data/database');

// Wheel segments with different prizes and probabilities
const wheelSegments = [
    { prize: 'BANKRUPT', multiplier: 0, color: '🔴', weight: 8 },
    { prize: '0.5x', multiplier: 0.5, color: '🟢', weight: 12 },
    { prize: '0.8x', multiplier: 0.8, color: '🔵', weight: 10 },
    { prize: '1.2x', multiplier: 1.2, color: '🟡', weight: 8 },
    { prize: '2x', multiplier: 2, color: '🟠', weight: 5 },
    { prize: '3x', multiplier: 3, color: '🟣', weight: 3 },
    { prize: '10x', multiplier: 10, color: '⚫', weight: 1.5 },
    { prize: 'JACKPOT', multiplier: 25, color: '💎', weight: 0.5 }
];

function getRandomSegment() {
    const totalWeight = wheelSegments.reduce((sum, segment) => sum + segment.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const segment of wheelSegments) {
        random -= segment.weight;
        if (random <= 0) {
            return segment;
        }
    }
    return wheelSegments[0]; // Fallback
}

function createWheelDisplay(highlightIndex = -1) {
    if (highlightIndex === -1) {
        return '🎪 **WHEEL OF FORTUNE** 🎪\n🎯 Ready to spin!';
    }
    
    const segment = wheelSegments[highlightIndex];
    return `🎪 **WHEEL STOPPED ON:**\n${segment.color} **${segment.prize}** ${segment.color}`;
}

function createSpinningEmbed(stage, bet, currentSegment = null) {
    const spinStages = [
        '🎪 **WELCOME TO THE WHEEL!** 🎪',
        '🎯 **SPINNING THE WHEEL...** 🌀',
        '🌪️ **WHEEL SPINNING FAST...** ⚡',
        '🎯 **SLOWING DOWN...** 🐌',
        '🎪 **ALMOST THERE...** 🤞',
        '🎉 **FINAL RESULT!** 🎊'
    ];

    const spinAnimations = [
        '```⠋ Preparing the wheel...```',
        '```⠙ Spinning at maximum speed!```',
        '```⠹ Wheel spinning rapidly!```',
        '```⠸ Starting to slow down...```',
        '```⠼ Coming to a stop...```',
        '```⠴ Stopped!```'
    ];

    let wheelDisplay = createWheelDisplay();
    // Don't show the result until the very end (stage 5)
    if (stage === 5 && currentSegment) {
        const segmentIndex = wheelSegments.findIndex(s => s.prize === currentSegment.prize);
        wheelDisplay = createWheelDisplay(segmentIndex);
    }

    return new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎪 **WHEEL OF FORTUNE** 🎪')
        .setDescription(`${spinStages[stage]}\n${wheelDisplay}\n${spinAnimations[stage]}`)
        .addFields(
            { name: '💰 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
                                { name: '🎯 **Possible Prizes**', value: '💎 JACKPOT: 25x\n⚫ Big Win: 10x\n🟣 Good: 3x\n🔴 BANKRUPT: 0x', inline: true },
            { name: '🎲 **Status**', value: stage < 5 ? 'Spinning...' : 'Complete!', inline: true }
        )
        .setFooter({ text: '🍀 Good luck! The wheel is spinning!' });
}

function createResultEmbed(segment, bet, winAmount, newBalance, user) {
    const isBankrupt = segment.prize === 'BANKRUPT';
    const isJackpot = segment.prize === 'JACKPOT';
    const isGoodWin = segment.multiplier >= 2;
    
    let color = '#FF4757'; // Red for bankrupt
    let title = '💸 **BANKRUPT!** 💸';
    let description = '';
    
    if (isJackpot) {
        color = '#FFD700';
        title = '🎊 **JACKPOT WINNER!** 🎊';
        description = `**The wheel landed on ${segment.color} ${segment.prize}!**\n\n💎 **INCREDIBLE! YOU HIT THE JACKPOT!** 💎\n🎉 **You won $${winAmount.toLocaleString()}!** 🎉`;
    } else if (isGoodWin) {
        color = '#00FF7F';
        title = '🎉 **BIG WIN!** 🎉';
        description = `**The wheel landed on ${segment.color} ${segment.prize}!**\n\n🎊 **Great spin! You multiplied your bet!** 🎊\n💰 **You won $${winAmount.toLocaleString()}!** 💰`;
    } else if (isBankrupt) {
        description = `**The wheel landed on ${segment.color} ${segment.prize}!**\n\n💸 **Tough luck! You lost everything this spin.**\nBetter luck next time!`;
    } else {
        color = '#FFA500';
        title = '🎯 **SMALL WIN** 🎯';
        description = `**The wheel landed on ${segment.color} ${segment.prize}!**\n\n💰 **You won $${winAmount.toLocaleString()}!** 💰`;
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .addFields(
            { name: '🎯 **Wheel Result**', value: `${segment.color} **${segment.prize}**`, inline: true },
            { name: '💰 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
            { name: '🏆 **Prize Won**', value: isBankrupt ? `💸 **Lost $${bet.toLocaleString()}**` : `🎉 **Won $${winAmount.toLocaleString()}!**`, inline: true },
            { name: '💳 **New Balance**', value: `$${newBalance.toLocaleString()}`, inline: true },
            { name: '📊 **Multiplier**', value: isBankrupt ? '0x (Bankrupt)' : `${segment.multiplier}x`, inline: true },
            { name: '🎪 **Next Spin**', value: 'Spin again for more prizes!', inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ 
            text: isJackpot ? '🎊 JACKPOT WINNER! Congratulations!' : 
                  isBankrupt ? '💸 Bankrupt! Try again with a smaller bet!' :
                  '🎪 Great spin! Try your luck again!',
            iconURL: user.client.user.displayAvatarURL()
        })
        .setTimestamp();

    // Add simple wheel result display
    embed.addFields({
        name: '🎪 **Wheel Result**',
        value: `${segment.color} **${segment.prize}** ${segment.color}`,
        inline: false
    });

    return embed;
}

module.exports = {
    name: 'wheel',
    description: '🎪 Spin the Wheel of Fortune for amazing prizes!',
    aliases: ['spin', 'fortune'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const userId = message.author.id;
        const user = getUser(userId);

        // Check if user is blocked from gambling due to overdue loans
        if (isBlockedFromGambling(userId)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🚫 **Gambling Blocked**')
                .setDescription('**You cannot gamble due to overdue loans!**')
                .addFields(
                    { name: '⚠️ **Reason**', value: 'You have overdue loans that must be repaid', inline: true },
                    { name: '💡 **Solution**', value: 'Use `$repay @lender` to pay back loans', inline: true },
                    { name: '📊 **Check Status**', value: 'Use `$credit` to view your loans', inline: true },
                    { name: '🎁 **Still Available**', value: 'Daily bonuses still work with `$daily`', inline: false }
                )
                .setFooter({ text: '💳 Repay your loans to unlock gambling!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Input validation
        if (isNaN(bet) || bet <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🎪 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$wheel <amount>`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '🎯 **Possible Prizes**', value: '💎 JACKPOT (25x)\n⚫ Big Win (10x)\n🟣 Good (3x)\n🔴 BANKRUPT (0x)', inline: true }
                )
                .setFooter({ text: '🎪 Enter a valid bet amount to spin the wheel!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to spin the wheel!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to spin the wheel!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Get the winning segment
        const winningSegment = getRandomSegment();

        // Start spinning animation
        const spinMessage = await message.channel.send({ 
            embeds: [createSpinningEmbed(0, bet)] 
        });
        
        // Animate the spinning wheel
        for (let i = 1; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await spinMessage.edit({ 
                embeds: [createSpinningEmbed(i, bet, i === 5 ? winningSegment : null)] 
            });
        }

        // Calculate winnings
        let winAmount = 0;
        const isBankrupt = winningSegment.prize === 'BANKRUPT';
        
        // Remove bet from user
        removeMoney(userId, bet);
        
        // Add 10% of bet to lottery jackpot
        contributeLotteryFromBet(bet);
        
        if (!isBankrupt) {
            winAmount = Math.floor(bet * winningSegment.multiplier);
            addMoney(userId, winAmount);
        }

        // Update stats
        const db = readDb();
        db.users[userId].stats.gamesPlayed++;
        if (!isBankrupt) {
            db.users[userId].stats.gamesWon++;
            if (winAmount > db.users[userId].stats.biggestWin) {
                db.users[userId].stats.biggestWin = winAmount;
            }
        }
        writeDb(db);

        // Show final result
        await new Promise(resolve => setTimeout(resolve, 1500));
        const updatedUser = getUser(userId);
        const resultEmbed = createResultEmbed(winningSegment, bet, winAmount, updatedUser.balance, message.author);
        
        await spinMessage.edit({ embeds: [resultEmbed] });
    }
}; 