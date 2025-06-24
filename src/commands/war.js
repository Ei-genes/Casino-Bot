const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, readDb, writeDb } = require('../data/database');

const suits = ['♠️', '♥️', '♦️', '♣️'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ 
                rank, 
                suit, 
                value: getCardValue(rank),
                display: `${rank}${suit}`
            });
        }
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function getCardValue(rank) {
    const values = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
        'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank];
}

function createBattleEmbed(stage, bet, playerCard = null, dealerCard = null) {
    const battleStages = [
        { emoji: '🎴', text: 'Shuffling the war deck...' },
        { emoji: '⚔️', text: 'Preparing for battle...' },
        { emoji: '🃏', text: 'Drawing your card...' },
        { emoji: '🎰', text: 'Drawing dealer card...' },
        { emoji: '⚡', text: 'Cards clash in battle...' },
        { emoji: '🏆', text: 'Determining the victor...' }
    ];

    const currentStage = battleStages[stage];
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('⚔️ **CARD WAR BATTLEFIELD** ⚔️')
        .setDescription(`**Welcome to the War Zone!**\n\n${currentStage.emoji} ${currentStage.text}`)
        .addFields(
            { name: '💰 **Your Bet**', value: `$${bet.toLocaleString()}`, inline: true },
            { name: '🎯 **Game Mode**', value: 'Classic War', inline: true },
            { name: '🎲 **Payout**', value: 'Win: 2:1 | Tie: 1:1', inline: true }
        );

    if (playerCard && dealerCard) {
        embed.addFields(
            { name: '👤 **Your Card**', value: `${playerCard.display}\n**Value: ${playerCard.value}**`, inline: true },
            { name: '🎰 **Dealer Card**', value: `${dealerCard.display}\n**Value: ${dealerCard.value}**`, inline: true },
            { name: '⚔️ **Battle**', value: 'Cards drawn!', inline: true }
        );
    }

    embed.setFooter({ text: '⚔️ Higher card wins the war! Ace is highest!' });
    
    return embed;
}

function createResultEmbed(playerCard, dealerCard, bet, winAmount, newBalance, user, result) {
    const isWin = winAmount > bet;
    const isTie = result === 'TIE';
    
    let embedColor = '#FF4757'; // Red for loss
    let title = '💸 **WAR DEFEAT** 💸';
    let description = '';
    
    if (isWin) {
        embedColor = '#00FF7F'; // Green for win
        title = '🎉 **WAR VICTORY!** 🎉';
        description = `🎊 **Your ${playerCard.display} defeats dealer's ${dealerCard.display}!** 🎊\n**You won $${winAmount.toLocaleString()}!**`;
    } else if (isTie) {
        embedColor = '#FFD700'; // Gold for tie
        title = '⚔️ **WAR TIE!** ⚔️';
        description = `🤝 **Both drew ${playerCard.display}! It's a tie!**\n**Your bet is returned: $${bet.toLocaleString()}**`;
    } else {
        description = `💸 **Dealer's ${dealerCard.display} defeats your ${playerCard.display}!**\n**You lost $${bet.toLocaleString()}.**`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setDescription(description)
        .addFields(
            {
                name: '👤 **Your Card**',
                value: `${playerCard.display}\n**Value: ${playerCard.value}**`,
                inline: true
            },
            {
                name: '🎰 **Dealer Card**',
                value: `${dealerCard.display}\n**Value: ${dealerCard.value}**`,
                inline: true
            },
            {
                name: '⚔️ **Battle Result**',
                value: `**${result}**`,
                inline: true
            },
            {
                name: '💰 **Bet Amount**',
                value: `$${bet.toLocaleString()}`,
                inline: true
            },
            {
                name: '🏆 **Winnings**',
                value: isWin ? `🎉 **$${winAmount.toLocaleString()}**` : isTie ? `🤝 **$${bet.toLocaleString()}** (returned)` : `💸 **$0**`,
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
            text: isWin ? '⚔️ Victorious warrior! Battle again!' : isTie ? '⚔️ Honorable tie! Try again!' : '⚔️ Fight another day, warrior!',
        })
        .setTimestamp();

    // Add game rules
    embed.addFields({
        name: '⚔️ **War Rules**',
        value: '**Higher card wins!** 🏆\n**Card Values:** 2-10, J(11), Q(12), K(13), A(14)\n**Win:** 2x your bet | **Tie:** Bet returned\n**Simple and fast-paced!**',
        inline: false
    });

    return embed;
}

module.exports = {
    name: 'war',
    description: '⚔️ Play Card War - highest card wins!',
    aliases: ['cardwar', 'battle'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const userId = message.author.id;
        const user = getUser(userId);

        // Input validation
        if (isNaN(bet) || bet <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('⚔️ **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$war <amount>`', inline: true },
                    { name: '💡 **Example**', value: '`$war 100`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '⚔️ Enter the battlefield with your bet!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to enter the war!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to join the war!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Start battle animation
        const battleMessage = await message.channel.send({ 
            embeds: [createBattleEmbed(0, bet)] 
        });
        
        // Animate the battle preparation
        for (let i = 1; i < 4; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await battleMessage.edit({ 
                embeds: [createBattleEmbed(i, bet)] 
            });
        }

        // Create deck and draw cards
        const deck = createDeck();
        const playerCard = deck[Math.floor(Math.random() * deck.length)];
        const dealerCard = deck[Math.floor(Math.random() * deck.length)];

        // Show cards drawn
        await new Promise(resolve => setTimeout(resolve, 1000));
        await battleMessage.edit({ 
            embeds: [createBattleEmbed(4, bet, playerCard, dealerCard)] 
        });

        await new Promise(resolve => setTimeout(resolve, 1500));
        await battleMessage.edit({ 
            embeds: [createBattleEmbed(5, bet, playerCard, dealerCard)] 
        });

        // Determine winner
        let result = '';
        let winAmount = 0;
        
        if (playerCard.value > dealerCard.value) {
            result = 'VICTORY';
            winAmount = bet * 2; // Win: 2x bet
        } else if (playerCard.value < dealerCard.value) {
            result = 'DEFEAT';
            winAmount = 0; // Loss: lose bet
        } else {
            result = 'TIE';
            winAmount = bet; // Tie: return bet
        }

        // Process bet
        removeMoney(userId, bet);
        if (winAmount > 0) {
            addMoney(userId, winAmount);
        }

        // Update stats
        const db = readDb();
        db.users[userId].stats.gamesPlayed++;
        if (result === 'VICTORY') {
            db.users[userId].stats.gamesWon++;
            if (winAmount > db.users[userId].stats.biggestWin) {
                db.users[userId].stats.biggestWin = winAmount;
            }
        }
        writeDb(db);

        // Show final result
        await new Promise(resolve => setTimeout(resolve, 1500));
        const updatedUser = getUser(userId);
        const resultEmbed = createResultEmbed(playerCard, dealerCard, bet, winAmount, updatedUser.balance, message.author, result);
        await battleMessage.edit({ embeds: [resultEmbed] });
    }
}; 