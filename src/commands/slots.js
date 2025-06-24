const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, updateJackpot, resetJackpot, getJackpot, contributeLotteryFromBet, readDb, writeDb, isBlockedFromGambling } = require('../data/database');

const symbols = ['🍒', '🍋', '🍊', '🍉', '🍇', '💎', '💰'];
const payouts = {
    '🍒': 5,
    '🍋': 8,
    '🍊': 10,
    '🍉': 15,
    '🍇': 20,
    '💎': 50,
    '💰': 100
};

function getRandomSymbol() {
    return symbols[Math.floor(Math.random() * symbols.length)];
}

function createSpinningEmbed(stage, bet, reel1, reel2, reel3, jackpot) {
    const spinStages = [
        '🎰 **INSERTING COINS...** 🪙',
        '🎰 **PULLING THE LEVER...** 🎪',
        '🎰 **REELS SPINNING...** 🌀',
        '🎰 **FIRST REEL STOPPING...** 🎯',
        '🎰 **SECOND REEL STOPPING...** 🎯',
        '🎰 **FINAL REEL...** 🤞'
    ];

    let reelDisplay = '';
    let spinningAnimation = '';

    switch(stage) {
        case 0:
            reelDisplay = '[ 🎰 | 🎰 | 🎰 ]';
            spinningAnimation = '```⠋ Preparing slot machine...```';
            break;
        case 1:
            reelDisplay = '[ 🌀 | 🌀 | 🌀 ]';
            spinningAnimation = '```⠙ Spinning reels...```';
            break;
        case 2:
            reelDisplay = '[ ⚡ | ⚡ | ⚡ ]';
            spinningAnimation = '```⠹ Maximum speed!```';
            break;
        case 3:
            reelDisplay = `[ ${reel1} | 🌀 | 🌀 ]`;
            spinningAnimation = '```⠸ First reel locked!```';
            break;
        case 4:
            reelDisplay = `[ ${reel1} | ${reel2} | 🌀 ]`;
            spinningAnimation = '```⠼ Second reel locked!```';
            break;
        case 5:
            reelDisplay = `[ ${reel1} | ${reel2} | ❓ ]`;
            spinningAnimation = '```⠴ Final reel slowing...```';
            break;
    }

    return new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎰 **SLOT MACHINE** 🎰')
        .setDescription(`${spinStages[stage]}\n\n**${reelDisplay}**\n\n${spinningAnimation}`)
        .addFields(
            { name: '💰 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
            { name: '🎰 **Current Jackpot**', value: `$${jackpot.toLocaleString()}`, inline: true },
            { name: '🎲 **Status**', value: 'Spinning...', inline: true }
        )
        .setFooter({ text: '🍀 Good luck! The reels are spinning!' });
}

function createResultEmbed(reel1, reel2, reel3, result, bet, newBalance, user, jackpot) {
    const isWin = reel1 === reel2 && reel2 === reel3;
    const isJackpot = result.type === 'jackpot';
    
    let color = '#FF4757'; // Default red for loss
    let title = '🎰 **SLOT MACHINE RESULT** 🎰';
    let description = '';
    
    if (isJackpot) {
        color = '#FFD700';
        title = '🎊 **MASSIVE JACKPOT WIN!** 🎊';
        description = `**[ ${reel1} | ${reel2} | ${reel3} ]**\n\n🎉 **INCREDIBLE! YOU HIT THE JACKPOT!** 🎉\n💰 **You won $${result.amount.toLocaleString()}!** 💰`;
    } else if (isWin) {
        color = '#00FF7F';
        title = '🎉 **TRIPLE MATCH WIN!** 🎉';
        description = `**[ ${reel1} | ${reel2} | ${reel3} ]**\n\n🎊 **Amazing! Three ${reel1}s!** 🎊\n💰 **You won $${result.amount.toLocaleString()}!** 💰`;
    } else {
        description = `**[ ${reel1} | ${reel2} | ${reel3} ]**\n\n💸 **No match this time.**\nBetter luck on your next spin!`;
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .addFields(
            { name: '💰 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
            { name: '🎯 **Result**', value: isWin ? `🎉 **WON $${result.amount.toLocaleString()}!**` : `💸 **Lost $${bet.toLocaleString()}**`, inline: true },
            { name: '💳 **New Balance**', value: `$${newBalance.toLocaleString()}`, inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ 
            text: isJackpot ? '🎊 CONGRATULATIONS ON THE JACKPOT!' : 
                  isWin ? '🎉 Amazing win! Try again for the jackpot!' : 
                  '🎰 Keep spinning for your chance at the jackpot!',
            iconURL: user.client.user.displayAvatarURL()
        })
        .setTimestamp();

    // Add jackpot info
    if (isJackpot) {
        embed.addFields({
            name: '🆕 **New Jackpot**',
            value: `$${jackpot.toLocaleString()}`,
            inline: false
        });
    } else {
        embed.addFields({
            name: '🎰 **Current Jackpot**',
            value: `$${jackpot.toLocaleString()}`,
            inline: false
        });
    }

    // Add payout table for reference
    embed.addFields({
        name: '💎 **Payout Table**',
        value: '🍒 Cherry: 5x bet\n🍋 Lemon: 8x bet\n🍊 Orange: 10x bet\n🍉 Watermelon: 15x bet\n🍇 Grapes: 20x bet\n💎 Diamond: 50x bet\n💰 Money: 100x bet\n🎰 **JACKPOT**: Triple 💰',
        inline: true
    });

    return embed;
}

module.exports = {
    name: 'slots',
    description: '🎰 Spin the slot machine for massive wins and growing jackpot!',
    aliases: ['slot', 'spin'],
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
            const jackpot = getJackpot();
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$slots <amount>`', inline: true },
                    { name: '💡 **Example**', value: '`$slots 100`', inline: true },
                    { name: '🎰 **Current Jackpot**', value: `$${jackpot.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🎰 Enter a valid bet amount to spin!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const jackpot = getJackpot();
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to spin the slots!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '🎰 **Current Jackpot**', value: `$${jackpot.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: false }
                )
                .setFooter({ text: '💰 Earn more money to play slots!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Generate final results
        const reel1 = getRandomSymbol();
        const reel2 = getRandomSymbol();
        const reel3 = getRandomSymbol();
        const currentJackpot = getJackpot();

        // Start spinning animation
        const spinMessage = await message.channel.send({ 
            embeds: [createSpinningEmbed(0, bet, reel1, reel2, reel3, currentJackpot)] 
        });
        
        // Animate the spinning reels
        for (let i = 1; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 800));
            await spinMessage.edit({ 
                embeds: [createSpinningEmbed(i, bet, reel1, reel2, reel3, currentJackpot)] 
            });
        }

        // Calculate result
        let result = { type: 'loss', amount: 0 };
        let newJackpot = currentJackpot;

        // Remove bet from user
        removeMoney(userId, bet);
        
        // Add 10% of bet to lottery jackpot
        contributeLotteryFromBet(bet);

        // Check for jackpot (triple money symbols)
        if (reel1 === '💰' && reel2 === '💰' && reel3 === '💰') {
            result = { type: 'jackpot', amount: currentJackpot };
            addMoney(userId, currentJackpot);
            newJackpot = resetJackpot(); // Reset to 10,000
        } else if (reel1 === reel2 && reel2 === reel3) {
            // Regular triple match
            const winAmount = bet * payouts[reel1];
            result = { type: 'win', amount: winAmount };
            addMoney(userId, winAmount);
            // Add to jackpot
            newJackpot = updateJackpot(Math.floor(bet * 0.1)); // 10% of bet goes to jackpot
        } else {
            // Loss - add to jackpot
            newJackpot = updateJackpot(Math.floor(bet * 0.1)); // 10% of bet goes to jackpot
        }

        // Update user stats
        const db = readDb();
        db.users[userId].stats.gamesPlayed++;
        if (result.type !== 'loss') {
            db.users[userId].stats.gamesWon++;
            if (result.amount > db.users[userId].stats.biggestWin) {
                db.users[userId].stats.biggestWin = result.amount;
            }
        }
        writeDb(db);

        // Show final result
        await new Promise(resolve => setTimeout(resolve, 1000));
        const updatedUser = getUser(userId);
        const resultEmbed = createResultEmbed(reel1, reel2, reel3, result, bet, updatedUser.balance, message.author, newJackpot);
        await spinMessage.edit({ embeds: [resultEmbed] });
    }
}; 