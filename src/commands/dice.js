const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, contributeLotteryFromBet, readDb, writeDb, isBlockedFromGambling } = require('../data/database');

const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const payouts = {
    1: 6,   // Rolling 1 pays 6x
    2: 3,   // Rolling 2 pays 3x
    3: 2,   // Rolling 3 pays 2x
    4: 2,   // Rolling 4 pays 2x
    5: 3,   // Rolling 5 pays 3x
    6: 6    // Rolling 6 pays 6x
};

module.exports = {
    name: 'dice',
    description: '🎲 Roll dice and win based on the number you get!',
    aliases: ['roll'],
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
                .setTitle('🎲 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$dice <amount>`', inline: true },
                    { name: '💡 **Example**', value: '`$dice 100`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🎲 Roll the dice and win big!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to play dice!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to play dice!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Create rolling animation
        const rollStages = [
            { emoji: '🎲', text: 'Shaking the dice...' },
            { emoji: '🌀', text: 'Rolling across the table...' },
            { emoji: '✨', text: 'Dice spinning...' },
            { emoji: '🎯', text: 'Coming to a stop...' },
            { emoji: '📍', text: 'Final result...' }
        ];

        const rollEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎲 **DICE ROLL** 🎲')
            .setDescription(`**${message.author.username} is rolling the dice!**\n\n${rollStages[0].emoji} ${rollStages[0].text}`)
            .addFields(
                { name: '💰 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
                { name: '🎯 **Possible Wins**', value: '⚀ 1: 6x bet\n⚁ 2: 3x bet\n⚂ 3: 2x bet', inline: true },
                { name: '🎯 **More Wins**', value: '⚃ 4: 2x bet\n⚄ 5: 3x bet\n⚅ 6: 6x bet', inline: true }
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: '🍀 Good luck! The dice is rolling!' });

        const rollMessage = await message.channel.send({ embeds: [rollEmbed] });

        // Animate the roll
        for (let i = 1; i < rollStages.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 800));
            rollEmbed.setDescription(`**${message.author.username} is rolling the dice!**\n\n${rollStages[i].emoji} ${rollStages[i].text}`);
            await rollMessage.edit({ embeds: [rollEmbed] });
        }

        // Determine result
        const diceResult = Math.floor(Math.random() * 6) + 1; // 1-6
        const resultEmoji = diceEmojis[diceResult - 1];
        const multiplier = payouts[diceResult];
        const winAmount = bet * multiplier;

        // Process bet
        removeMoney(userId, bet);
        
        // Add 10% of bet to lottery jackpot
        contributeLotteryFromBet(bet);
        
        addMoney(userId, winAmount);

        // Update stats
        const db = readDb();
        db.users[userId].stats.gamesPlayed++;
        db.users[userId].stats.gamesWon++; // Dice always wins something
        if (winAmount > db.users[userId].stats.biggestWin) {
            db.users[userId].stats.biggestWin = winAmount;
        }
        writeDb(db);

        // Create result embed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const updatedUser = getUser(userId);
        const netProfit = winAmount - bet;
        
        let resultColor = '#00FF7F'; // Green for profit
        let resultTitle = '🎉 **DICE WIN!** 🎉';
        
        if (netProfit <= 0) {
            resultColor = '#FFD700'; // Gold for break-even/small loss
            resultTitle = '🎲 **DICE RESULT** 🎲';
        }

        const resultEmbed = new EmbedBuilder()
            .setColor(resultColor)
            .setTitle(resultTitle)
            .setDescription(`**You rolled a ${resultEmoji} ${diceResult}!**\n\n${netProfit > 0 ? `🎊 **You won $${winAmount.toLocaleString()}!** 🎊` : `💰 **You got $${winAmount.toLocaleString()} back!**`}`)
            .addFields(
                { name: '🎲 **Dice Result**', value: `${resultEmoji} **${diceResult}**`, inline: true },
                { name: '💰 **Multiplier**', value: `${multiplier}x bet`, inline: true },
                { name: '🏆 **Total Won**', value: `$${winAmount.toLocaleString()}`, inline: true },
                { name: '💸 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
                { name: '📈 **Net Profit**', value: `${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString()}`, inline: true },
                { name: '💳 **New Balance**', value: `$${updatedUser.balance.toLocaleString()}`, inline: true }
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ 
                text: netProfit > 0 ? '🎉 Great roll! Try again for more wins!' : '🎲 Every roll wins something!',
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Add payout table
        resultEmbed.addFields({
            name: '💎 **Payout Table**',
            value: '⚀ **1**: 6x bet (600% return)\n⚁ **2**: 3x bet (300% return)\n⚂ **3**: 2x bet (200% return)\n⚃ **4**: 2x bet (200% return)\n⚄ **5**: 3x bet (300% return)\n⚅ **6**: 6x bet (600% return)',
            inline: false
        });

        await rollMessage.edit({ embeds: [resultEmbed] });
    }
}; 