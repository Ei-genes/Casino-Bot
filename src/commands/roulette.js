const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, contributeLotteryFromBet, readDb, writeDb } = require('../data/database');

// Roulette wheel layout (European style)
const rouletteNumbers = [
    { number: 0, color: 'green' },
    { number: 32, color: 'red' }, { number: 15, color: 'black' }, { number: 19, color: 'red' }, { number: 4, color: 'black' },
    { number: 21, color: 'red' }, { number: 2, color: 'black' }, { number: 25, color: 'red' }, { number: 17, color: 'black' },
    { number: 34, color: 'red' }, { number: 6, color: 'black' }, { number: 27, color: 'red' }, { number: 13, color: 'black' },
    { number: 36, color: 'red' }, { number: 11, color: 'black' }, { number: 30, color: 'red' }, { number: 8, color: 'black' },
    { number: 23, color: 'red' }, { number: 10, color: 'black' }, { number: 5, color: 'red' }, { number: 24, color: 'black' },
    { number: 16, color: 'red' }, { number: 33, color: 'black' }, { number: 1, color: 'red' }, { number: 20, color: 'black' },
    { number: 14, color: 'red' }, { number: 31, color: 'black' }, { number: 9, color: 'red' }, { number: 22, color: 'black' },
    { number: 18, color: 'red' }, { number: 29, color: 'black' }, { number: 7, color: 'red' }, { number: 28, color: 'black' },
    { number: 12, color: 'red' }, { number: 35, color: 'black' }, { number: 3, color: 'red' }, { number: 26, color: 'black' }
];

const payouts = {
    'number': 35,     // Single number
    'red': 1,         // Red color
    'black': 1,       // Black color
    'even': 1,        // Even numbers
    'odd': 1,         // Odd numbers
    'low': 1,         // 1-18
    'high': 1,        // 19-36
    'dozen1': 2,      // 1-12
    'dozen2': 2,      // 13-24
    'dozen3': 2       // 25-36
};

function getNumberColor(num) {
    if (num === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? 'red' : 'black';
}

function createSpinningEmbed(stage, bet, betType, betValue) {
    const spinStages = [
        { emoji: '🎰', text: 'Placing your bet on the table...' },
        { emoji: '🎯', text: 'Spinning the roulette wheel...' },
        { emoji: '🌀', text: 'Ball bouncing around the wheel...' },
        { emoji: '⚡', text: 'Ball slowing down...' },
        { emoji: '🎪', text: 'Ball finding its pocket...' },
        { emoji: '📍', text: 'Final result coming up...' }
    ];

    const currentStage = spinStages[stage];
    
    return new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎰 **ROULETTE WHEEL** 🎰')
        .setDescription(`**Welcome to the Roulette Table!**\n\n${currentStage.emoji} ${currentStage.text}`)
        .addFields(
            { name: '💰 **Your Bet**', value: `$${bet.toLocaleString()}`, inline: true },
            { name: '🎯 **Bet Type**', value: `${betType.toUpperCase()}`, inline: true },
            { name: '🎲 **Bet Value**', value: `${betValue}`, inline: true }
        )
        .setFooter({ text: '🍀 The wheel is spinning! Good luck!' });
}

function createResultEmbed(result, bet, betType, betValue, winAmount, newBalance, user) {
    const resultNumber = result.number;
    const resultColor = result.color;
    
    let colorEmoji = '';
    let embedColor = '#FF4757'; // Default red for loss
    
    if (resultColor === 'red') {
        colorEmoji = '🔴';
    } else if (resultColor === 'black') {
        colorEmoji = '⚫';
    } else {
        colorEmoji = '🟢';
    }
    
    const isWin = winAmount > 0;
    if (isWin) {
        embedColor = '#00FF7F'; // Green for win
    }
    
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(isWin ? '🎉 **ROULETTE WIN!** 🎉' : '💸 **ROULETTE RESULT** 💸')
        .setDescription(`**The ball landed on ${colorEmoji} ${resultNumber}!**\n\n${isWin ? `🎊 **Congratulations! You won $${winAmount.toLocaleString()}!** 🎊` : `💸 **Better luck next time! You lost $${bet.toLocaleString()}.**`}`)
        .addFields(
            { name: '🎯 **Winning Number**', value: `${colorEmoji} **${resultNumber}**`, inline: true },
            { name: '🎲 **Your Bet**', value: `${betType.toUpperCase()}: ${betValue}`, inline: true },
            { name: '💰 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
            { name: '🏆 **Result**', value: isWin ? `🎉 **WON $${winAmount.toLocaleString()}!**` : `💸 **Lost $${bet.toLocaleString()}**`, inline: true },
            { name: '💳 **New Balance**', value: `$${newBalance.toLocaleString()}`, inline: true },
            { name: '📊 **Payout**', value: isWin ? `${getPayoutMultiplier(betType)}:1` : '0:1', inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ 
            text: isWin ? '🎉 Amazing win! Try again for more!' : '🎰 Spin again for your chance to win!',
            iconURL: user.client.user.displayAvatarURL()
        })
        .setTimestamp();

    // Add betting options guide
    embed.addFields({
        name: '🎯 **Betting Options**',
        value: '**Numbers:** 0-36 (35:1)\n**Colors:** red, black (1:1)\n**Even/Odd:** even, odd (1:1)\n**Ranges:** low (1-18), high (19-36) (1:1)\n**Dozens:** dozen1 (1-12), dozen2 (13-24), dozen3 (25-36) (2:1)',
        inline: false
    });

    return embed;
}

function getPayoutMultiplier(betType) {
    return payouts[betType] || 0;
}

function checkWin(result, betType, betValue) {
    const num = result.number;
    const color = result.color;
    
    switch (betType) {
        case 'number':
            return num === parseInt(betValue);
        case 'red':
            return color === 'red';
        case 'black':
            return color === 'black';
        case 'even':
            return num !== 0 && num % 2 === 0;
        case 'odd':
            return num !== 0 && num % 2 === 1;
        case 'low':
            return num >= 1 && num <= 18;
        case 'high':
            return num >= 19 && num <= 36;
        case 'dozen1':
            return num >= 1 && num <= 12;
        case 'dozen2':
            return num >= 13 && num <= 24;
        case 'dozen3':
            return num >= 25 && num <= 36;
        default:
            return false;
    }
}

module.exports = {
    name: 'roulette',
    description: '🎰 Spin the roulette wheel and place your bets!',
    aliases: ['roul', 'wheel'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const betType = args[1]?.toLowerCase();
        const betValue = args[2];
        const userId = message.author.id;
        const user = getUser(userId);

        // Input validation
        if (isNaN(bet) || bet <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🎰 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$roulette <amount> <type> [value]`', inline: true },
                    { name: '💡 **Examples**', value: '`$roulette 100 red`\n`$roulette 50 number 7`\n`$roulette 200 even`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🎰 Place your bet and spin the wheel!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!betType) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🎰 **Missing Bet Type**')
                .setDescription('**You must specify what to bet on!**')
                .addFields(
                    { name: '🎯 **Bet Types**', value: '**Numbers:** `number 0-36` (35:1)\n**Colors:** `red`, `black` (1:1)\n**Even/Odd:** `even`, `odd` (1:1)', inline: true },
                    { name: '🎯 **More Bets**', value: '**Ranges:** `low` (1-18), `high` (19-36) (1:1)\n**Dozens:** `dozen1` (1-12), `dozen2` (13-24), `dozen3` (25-36) (2:1)', inline: true },
                    { name: '💡 **Examples**', value: '`$roulette 100 red`\n`$roulette 50 number 7`\n`$roulette 200 dozen1`', inline: false }
                )
                .setFooter({ text: '🎰 Choose your bet type and spin!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Validate bet type and value
        let finalBetValue = betValue;
        if (betType === 'number') {
            if (!betValue || isNaN(parseInt(betValue)) || parseInt(betValue) < 0 || parseInt(betValue) > 36) {
                const embed = new EmbedBuilder()
                    .setColor('#FF4757')
                    .setTitle('🎰 **Invalid Number**')
                    .setDescription('**For number bets, specify a number between 0-36!**')
                    .addFields(
                        { name: '💡 **Example**', value: '`$roulette 100 number 7`', inline: true },
                        { name: '🎯 **Valid Numbers**', value: '0, 1, 2, 3, ... 36', inline: true }
                    )
                    .setFooter({ text: '🎰 Pick a number between 0-36!' });
                return message.channel.send({ embeds: [embed] });
            }
            finalBetValue = parseInt(betValue);
        } else if (!['red', 'black', 'even', 'odd', 'low', 'high', 'dozen1', 'dozen2', 'dozen3'].includes(betType)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🎰 **Invalid Bet Type**')
                .setDescription('**That\'s not a valid bet type!**')
                .addFields(
                    { name: '✅ **Valid Bet Types**', value: '`red`, `black`, `even`, `odd`, `low`, `high`, `dozen1`, `dozen2`, `dozen3`, `number`', inline: false }
                )
                .setFooter({ text: '🎰 Choose a valid bet type!' });
            return message.channel.send({ embeds: [embed] });
        } else {
            finalBetValue = betType;
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to play roulette!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to play roulette!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Start spinning animation
        const spinMessage = await message.channel.send({ 
            embeds: [createSpinningEmbed(0, bet, betType, finalBetValue)] 
        });
        
        // Animate the spinning
        for (let i = 1; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await spinMessage.edit({ 
                embeds: [createSpinningEmbed(i, bet, betType, finalBetValue)] 
            });
        }

        // Generate result
        const result = rouletteNumbers[Math.floor(Math.random() * rouletteNumbers.length)];
        const isWin = checkWin(result, betType, finalBetValue);
        
        // Process bet
        removeMoney(userId, bet);
        
        // Add 10% of bet to lottery jackpot
        contributeLotteryFromBet(bet);
        
        let winAmount = 0;
        
        if (isWin) {
            const multiplier = getPayoutMultiplier(betType);
            winAmount = bet * (multiplier + 1); // +1 to include original bet
            addMoney(userId, winAmount);
        }

        // Update stats
        const db = readDb();
        db.users[userId].stats.gamesPlayed++;
        if (isWin) {
            db.users[userId].stats.gamesWon++;
            if (winAmount > db.users[userId].stats.biggestWin) {
                db.users[userId].stats.biggestWin = winAmount;
            }
        }
        writeDb(db);

        // Show final result
        await new Promise(resolve => setTimeout(resolve, 1500));
        const updatedUser = getUser(userId);
        const resultEmbed = createResultEmbed(result, bet, betType, finalBetValue, winAmount, updatedUser.balance, message.author);
        await spinMessage.edit({ embeds: [resultEmbed] });
    }
}; 