const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, contributeLotteryFromBet, readDb, writeDb, isBlockedFromGambling } = require('../data/database');

module.exports = {
    name: 'coinflip',
    description: '🪙 Flip a coin and double your money or lose it all!',
    aliases: ['cf', 'flip'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const choice = args[1]?.toLowerCase();
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
                .setTitle('🪙 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$coinflip <amount> <heads/tails>`', inline: true },
                    { name: '💡 **Example**', value: '`$coinflip 100 heads`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🪙 Choose heads or tails and double your money!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!choice || !['heads', 'tails', 'h', 't'].includes(choice)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🪙 **Invalid Choice**')
                .setDescription('**You must choose heads or tails!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$coinflip <amount> <heads/tails>`', inline: true },
                    { name: '✅ **Valid Choices**', value: '`heads`, `tails`, `h`, `t`', inline: true },
                    { name: '💡 **Example**', value: '`$coinflip 100 heads`', inline: true }
                )
                .setFooter({ text: '🪙 Pick your side and let\'s flip!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to play coinflip!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to play coinflip!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Normalize choice
        const playerChoice = choice === 'h' ? 'heads' : choice === 't' ? 'tails' : choice;
        const choiceEmoji = playerChoice === 'heads' ? '👑' : '🦅';

        // Create flipping animation
        const flipStages = [
            { emoji: '🪙', text: 'Preparing the coin...' },
            { emoji: '🌀', text: 'Flipping high into the air...' },
            { emoji: '✨', text: 'Coin spinning rapidly...' },
            { emoji: '🎯', text: 'Coming down...' },
            { emoji: '📍', text: 'Landing...' }
        ];

        const flipEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🪙 **COIN FLIP** 🪙')
            .setDescription(`**${message.author.username} chose ${choiceEmoji} ${playerChoice.toUpperCase()}!**\n\n${flipStages[0].emoji} ${flipStages[0].text}`)
            .addFields(
                { name: '💰 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
                { name: '🎯 **Your Choice**', value: `${choiceEmoji} ${playerChoice.toUpperCase()}`, inline: true },
                { name: '🎲 **Status**', value: 'Flipping...', inline: true }
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: '🍀 Good luck! The coin is in the air!' });

        const flipMessage = await message.channel.send({ embeds: [flipEmbed] });

        // Animate the flip
        for (let i = 1; i < flipStages.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 800));
            flipEmbed.setDescription(`**${message.author.username} chose ${choiceEmoji} ${playerChoice.toUpperCase()}!**\n\n${flipStages[i].emoji} ${flipStages[i].text}`);
            await flipMessage.edit({ embeds: [flipEmbed] });
        }

        // Determine result
        const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
        const resultEmoji = coinResult === 'heads' ? '👑' : '🦅';
        const isWinner = playerChoice === coinResult;

        // Process bet
        removeMoney(userId, bet);
        
        // Add 10% of bet to lottery jackpot
        contributeLotteryFromBet(bet);
        
        let winAmount = 0;
        if (isWinner) {
            winAmount = bet * 2; // Double the bet
            addMoney(userId, winAmount);
        }

        // Update stats
        const db = readDb();
        db.users[userId].stats.gamesPlayed++;
        if (isWinner) {
            db.users[userId].stats.gamesWon++;
            if (winAmount > db.users[userId].stats.biggestWin) {
                db.users[userId].stats.biggestWin = winAmount;
            }
        }
        writeDb(db);

        // Create result embed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const updatedUser = getUser(userId);
        const resultEmbed = new EmbedBuilder()
            .setColor(isWinner ? '#00FF7F' : '#FF4757')
            .setTitle(isWinner ? '🎉 **WINNER!** 🎉' : '💸 **YOU LOSE!** 💸')
            .setDescription(`**The coin landed on ${resultEmoji} ${coinResult.toUpperCase()}!**\n\n${isWinner ? `🎊 **Congratulations! You won $${winAmount.toLocaleString()}!** 🎊` : `💸 **Better luck next time! You lost $${bet.toLocaleString()}.**`}`)
            .addFields(
                { name: '🪙 **Coin Result**', value: `${resultEmoji} ${coinResult.toUpperCase()}`, inline: true },
                { name: '🎯 **Your Choice**', value: `${choiceEmoji} ${playerChoice.toUpperCase()}`, inline: true },
                { name: '💰 **Bet Amount**', value: `$${bet.toLocaleString()}`, inline: true },
                { name: '🏆 **Result**', value: isWinner ? `🎉 **WON $${winAmount.toLocaleString()}!**` : `💸 **Lost $${bet.toLocaleString()}**`, inline: true },
                { name: '💳 **New Balance**', value: `$${updatedUser.balance.toLocaleString()}`, inline: true },
                { name: '📊 **Win Rate**', value: updatedUser.stats.gamesPlayed > 0 ? `${((updatedUser.stats.gamesWon / updatedUser.stats.gamesPlayed) * 100).toFixed(1)}%` : '0%', inline: true }
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ 
                text: isWinner ? '🎉 Amazing! Try again to keep the streak going!' : '🪙 Better luck on your next flip!',
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await flipMessage.edit({ embeds: [resultEmbed] });
    }
}; 