const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, getLotteryJackpot, addToLotteryJackpot, resetLotteryJackpot, readDb, writeDb } = require('../data/database');

function createDrawingEmbed(stage, ticketPrice, playerNumber, jackpot, drawnNumber = null) {
    const drawStages = [
        { emoji: '🎫', text: 'Purchasing your lottery ticket...' },
        { emoji: '🎰', text: 'Drawing the winning number...' },
        { emoji: '🎊', text: 'Checking your ticket...' }
    ];

    const currentStage = drawStages[stage];
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎫 **MEGA JACKPOT LOTTERY** 🎫')
        .setDescription(`**Welcome to the Mega Jackpot Lottery!**\n\n${currentStage.emoji} ${currentStage.text}`)
        .addFields(
            { name: '🎫 **Ticket Price**', value: `$${ticketPrice.toLocaleString()}`, inline: true },
            { name: '🎯 **Your Number**', value: `**${playerNumber}**`, inline: true },
            { name: '💎 **Current Jackpot**', value: `$${jackpot.toLocaleString()}`, inline: true }
        );

    if (drawnNumber !== null) {
        embed.addFields({
            name: '🎰 **Winning Number**',
            value: `🔹 **${drawnNumber}** 🔹`,
            inline: false
        });
    }

    embed.setFooter({ text: '🍀 Match the number to win the entire jackpot!' });
    
    return embed;
}

function createResultEmbed(playerNumber, drawnNumber, ticketPrice, isWin, winAmount, newBalance, newJackpot, user) {
    let embedColor = '#FF4757'; // Red for loss
    let title = '💸 **LOTTERY RESULT** 💸';
    let description = '';
    
    if (isWin) {
        embedColor = '#FFD700'; // Gold for jackpot
        title = '🎊 **MEGA JACKPOT WIN!** 🎊';
        description = `🎉 **INCREDIBLE! You hit the jackpot!** 🎉\n**Your number ${playerNumber} matched ${drawnNumber}!**\n💎 **JACKPOT WIN: $${winAmount.toLocaleString()}!** 💎`;
    } else {
        description = `💸 **No luck this time!** Your number **${playerNumber}** didn't match **${drawnNumber}**.\n**Better luck next draw!**`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setDescription(description)
        .addFields(
            {
                name: '🎯 **Your Number**',
                value: `🔹 **${playerNumber}**`,
                inline: true
            },
            {
                name: '🎰 **Winning Number**',
                value: `🔸 **${drawnNumber}**`,
                inline: true
            },
            {
                name: '🎯 **Result**',
                value: isWin ? '🎊 **JACKPOT!**' : '💸 **No Match**',
                inline: true
            },
            {
                name: '🎫 **Ticket Price**',
                value: `$${ticketPrice.toLocaleString()}`,
                inline: true
            },
            {
                name: '🏆 **Winnings**',
                value: isWin ? `🎉 **$${winAmount.toLocaleString()}**` : `💸 **$0**`,
                inline: true
            },
            {
                name: '💳 **New Balance**',
                value: `$${newBalance.toLocaleString()}`,
                inline: true
            }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ 
            text: isWin ? '🎊 Incredible jackpot win! Congratulations!' : '🎫 Try again - jackpot keeps growing!',
        })
        .setTimestamp();

    // Add next jackpot info
    embed.addFields({
        name: '💎 **Next Jackpot**',
        value: `**$${newJackpot.toLocaleString()}** - Growing with every ticket!\n\n**How it works:**\n🎫 Pick a number 1-250\n💰 10% of ticket price goes to jackpot\n🎰 10% of all game bets grow the prize\n🎊 Winner takes the entire jackpot!`,
        inline: false
    });

    return embed;
}

function getTicketPrice() {
    const jackpot = getLotteryJackpot();
    // Base price of $100, increases as jackpot grows
    return Math.max(100, Math.floor(jackpot * 0.01));
}

module.exports = {
    name: 'lottery',
    description: '🎫 Play the mega jackpot lottery - pick a number 1-250!',
    aliases: ['lotto', 'jackpot'],
    async execute(message, args) {
        const playerNumber = parseInt(args[0]);
        const userId = message.author.id;
        const user = getUser(userId);

        // Get current jackpot and ticket price
        const currentJackpot = getLotteryJackpot();
        const ticketPrice = getTicketPrice();

        // Input validation
        if (isNaN(playerNumber) || playerNumber < 1 || playerNumber > 250) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🎫 **Invalid Number**')
                .setDescription('**You must pick a number between 1-250!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$lottery <number>`', inline: true },
                    { name: '💡 **Example**', value: '`$lottery 123`', inline: true },
                    { name: '🎯 **Valid Range**', value: '1 - 250', inline: true },
                    { name: '🎫 **Ticket Price**', value: `$${ticketPrice.toLocaleString()}`, inline: true },
                    { name: '💎 **Current Jackpot**', value: `$${currentJackpot.toLocaleString()}`, inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🎫 Pick a lucky number and win the mega jackpot!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, ticketPrice)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${ticketPrice.toLocaleString()} for a lottery ticket!**`)
                .addFields(
                    { name: '🎫 **Ticket Price**', value: `$${ticketPrice.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💎 **Current Jackpot**', value: `$${currentJackpot.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to buy a lottery ticket!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Start drawing animation
        const drawMessage = await message.channel.send({ 
            embeds: [createDrawingEmbed(0, ticketPrice, playerNumber, currentJackpot)] 
        });
        
        // Shorter animation
        await new Promise(resolve => setTimeout(resolve, 1000));
        await drawMessage.edit({ embeds: [createDrawingEmbed(1, ticketPrice, playerNumber, currentJackpot)] });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate winning number
        const winningNumber = Math.floor(Math.random() * 250) + 1;
        const isWin = playerNumber === winningNumber;
        
        // Process ticket purchase
        removeMoney(userId, ticketPrice);
        
        // Add 10% of ticket price to jackpot
        const jackpotContribution = Math.floor(ticketPrice * 0.1);
        addToLotteryJackpot(jackpotContribution);
        
        let winAmount = 0;
        let newJackpot = getLotteryJackpot();
        
        if (isWin) {
            // Winner gets the entire jackpot!
            winAmount = currentJackpot;
            addMoney(userId, winAmount);
            resetLotteryJackpot(); // Reset to base amount
            newJackpot = getLotteryJackpot();
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
        await drawMessage.edit({ embeds: [createDrawingEmbed(2, ticketPrice, playerNumber, currentJackpot, winningNumber)] });
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        const updatedUser = getUser(userId);
        const resultEmbed = createResultEmbed(playerNumber, winningNumber, ticketPrice, isWin, winAmount, updatedUser.balance, newJackpot, message.author);
        await drawMessage.edit({ embeds: [resultEmbed] });
    }
}; 