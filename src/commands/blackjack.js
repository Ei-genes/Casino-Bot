const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, readDb, writeDb } = require('../data/database');

// Card deck and values
const suits = ['♠️', '♥️', '♦️', '♣️'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const activeGames = new Map();

function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ rank, suit, value: getCardValue(rank) });
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
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
}

function calculateHandValue(hand) {
    let value = 0;
    let aces = 0;
    
    for (const card of hand) {
        value += card.value;
        if (card.rank === 'A') aces++;
    }
    
    // Adjust for aces
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    
    return value;
}

function formatCard(card) {
    return `${card.rank}${card.suit}`;
}

function formatHand(hand, hideFirst = false) {
    if (hideFirst && hand.length > 0) {
        return `🂠 ${hand.slice(1).map(formatCard).join(' ')}`;
    }
    return hand.map(formatCard).join(' ');
}

function createGameEmbed(game, status, showDealerCards = false) {
    const playerValue = calculateHandValue(game.playerHand);
    const dealerValue = calculateHandValue(game.dealerHand);
    
    let color = '#FFD700';
    if (status.includes('WIN') || status.includes('BLACKJACK')) color = '#00FF7F';
    if (status.includes('BUST') || status.includes('LOSE')) color = '#FF4757';
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🃏 **BLACKJACK TABLE** 🃏')
        .setDescription(`**${game.playerName}** vs **Dealer**\n*${status}*`)
        .addFields(
            {
                name: '🎰 **Dealer\'s Hand**',
                value: `${formatHand(game.dealerHand, !showDealerCards)}\n**Value:** ${showDealerCards ? dealerValue : '?'}`,
                inline: true
            },
            {
                name: '👤 **Your Hand**',
                value: `${formatHand(game.playerHand)}\n**Value:** ${playerValue}`,
                inline: true
            },
            {
                name: '💰 **Bet Info**',
                value: `**Bet:** $${game.bet.toLocaleString()}\n**Potential Win:** $${(game.bet * 2).toLocaleString()}`,
                inline: true
            }
        )
        .setThumbnail(game.playerAvatar)
        .setFooter({ text: '🃏 Hit to get another card, Stand to keep your hand' })
        .setTimestamp();
    
    return embed;
}

function createButtons(gameId, gameOver = false) {
    if (gameOver) return [];
    
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`bj_hit_${gameId}`)
                .setLabel('🃏 Hit')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`bj_stand_${gameId}`)
                .setLabel('✋ Stand')
                .setStyle(ButtonStyle.Secondary)
        );
}

module.exports = {
    name: 'blackjack',
    description: '🃏 Play classic Blackjack against the dealer!',
    aliases: ['bj', '21'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const userId = message.author.id;
        const user = getUser(userId);

        // Check if user already has an active game
        if (activeGames.has(userId)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🃏 **Game In Progress**')
                .setDescription('**You already have an active Blackjack game!**\nFinish your current game before starting a new one.')
                .setFooter({ text: '🃏 Complete your current hand first!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Input validation
        if (isNaN(bet) || bet <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🃏 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$blackjack <amount>`', inline: true },
                    { name: '💡 **Example**', value: '`$blackjack 100`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🃏 Place your bet and play Blackjack!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to play Blackjack!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to play Blackjack!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Create loading animation
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🃏 **Starting Blackjack Game...**')
            .setDescription('```\n⠋ Shuffling deck...\n⠙ Dealing cards...\n⠹ Setting up table...\n```')
            .setThumbnail(message.author.displayAvatarURL());

        const gameMessage = await message.channel.send({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create game
        const deck = createDeck();
        const game = {
            playerId: userId,
            playerName: message.author.username,
            playerAvatar: message.author.displayAvatarURL(),
            bet: bet,
            deck: deck,
            playerHand: [deck.pop(), deck.pop()],
            dealerHand: [deck.pop(), deck.pop()],
            gameId: `${userId}_${Date.now()}`
        };

        activeGames.set(userId, game);
        removeMoney(userId, bet);

        // Check for immediate blackjack
        const playerValue = calculateHandValue(game.playerHand);
        const dealerValue = calculateHandValue(game.dealerHand);

        if (playerValue === 21) {
            if (dealerValue === 21) {
                // Push
                addMoney(userId, bet);
                activeGames.delete(userId);
                const embed = createGameEmbed(game, '🤝 **PUSH!** Both have Blackjack!', true);
                await gameMessage.edit({ embeds: [embed], components: [] });
            } else {
                // Player blackjack wins
                const winAmount = Math.floor(bet * 2.5); // Blackjack pays 3:2
                addMoney(userId, winAmount);
                activeGames.delete(userId);
                
                // Update stats
                const db = readDb();
                db.users[userId].stats.gamesPlayed++;
                db.users[userId].stats.gamesWon++;
                if (winAmount > db.users[userId].stats.biggestWin) {
                    db.users[userId].stats.biggestWin = winAmount;
                }
                writeDb(db);

                const embed = createGameEmbed(game, '🎊 **BLACKJACK!** You win!', true);
                embed.addFields({
                    name: '🎉 **Blackjack Win!**',
                    value: `**Won:** $${winAmount.toLocaleString()}\n**New Balance:** $${getUser(userId).balance.toLocaleString()}`,
                    inline: false
                });
                await gameMessage.edit({ embeds: [embed], components: [] });
            }
        } else {
            // Normal game continues
            const embed = createGameEmbed(game, 'Your turn - Hit or Stand?');
            const buttons = createButtons(game.gameId);
            await gameMessage.edit({ embeds: [embed], components: [buttons] });

            // Set up button collector
            const collector = gameMessage.createMessageComponentCollector({
                time: 300000 // 5 minutes
            });

            collector.on('collect', async (interaction) => {
                if (interaction.user.id !== userId) {
                    return interaction.reply({
                        content: '❌ This is not your game!',
                        ephemeral: true
                    });
                }

                const currentGame = activeGames.get(userId);
                if (!currentGame) {
                    return interaction.reply({
                        content: '❌ Game not found!',
                        ephemeral: true
                    });
                }

                if (interaction.customId.startsWith('bj_hit_')) {
                    // Hit
                    currentGame.playerHand.push(currentGame.deck.pop());
                    const newPlayerValue = calculateHandValue(currentGame.playerHand);
                    
                    if (newPlayerValue > 21) {
                        // Bust
                        activeGames.delete(userId);
                        
                        // Update stats
                        const db = readDb();
                        db.users[userId].stats.gamesPlayed++;
                        writeDb(db);

                        const embed = createGameEmbed(currentGame, '💥 **BUST!** You lose!', true);
                        embed.addFields({
                            name: '💸 **You Lost**',
                            value: `**Lost:** $${bet.toLocaleString()}\n**New Balance:** $${getUser(userId).balance.toLocaleString()}`,
                            inline: false
                        });
                        await interaction.update({ embeds: [embed], components: [] });
                        collector.stop();
                    } else {
                        const embed = createGameEmbed(currentGame, 'Your turn - Hit or Stand?');
                        const buttons = createButtons(currentGame.gameId);
                        await interaction.update({ embeds: [embed], components: [buttons] });
                    }
                } else if (interaction.customId.startsWith('bj_stand_')) {
                    // Stand - dealer plays
                    while (calculateHandValue(currentGame.dealerHand) < 17) {
                        currentGame.dealerHand.push(currentGame.deck.pop());
                    }
                    
                    const finalPlayerValue = calculateHandValue(currentGame.playerHand);
                    const finalDealerValue = calculateHandValue(currentGame.dealerHand);
                    
                    activeGames.delete(userId);
                    
                    let result = '';
                    let winAmount = 0;
                    let won = false;
                    
                    if (finalDealerValue > 21) {
                        result = '🎉 **DEALER BUST!** You win!';
                        winAmount = bet * 2;
                        won = true;
                    } else if (finalPlayerValue > finalDealerValue) {
                        result = '🎉 **YOU WIN!** Higher hand!';
                        winAmount = bet * 2;
                        won = true;
                    } else if (finalPlayerValue < finalDealerValue) {
                        result = '💸 **DEALER WINS!** Higher hand!';
                    } else {
                        result = '🤝 **PUSH!** Same value!';
                        winAmount = bet; // Return bet
                    }
                    
                    if (winAmount > 0) {
                        addMoney(userId, winAmount);
                    }
                    
                    // Update stats
                    const db = readDb();
                    db.users[userId].stats.gamesPlayed++;
                    if (won) {
                        db.users[userId].stats.gamesWon++;
                        if (winAmount > db.users[userId].stats.biggestWin) {
                            db.users[userId].stats.biggestWin = winAmount;
                        }
                    }
                    writeDb(db);

                    const embed = createGameEmbed(currentGame, result, true);
                    embed.addFields({
                        name: won ? '🎉 **You Won!**' : result.includes('PUSH') ? '🤝 **Push**' : '💸 **You Lost**',
                        value: `**Amount:** $${winAmount > 0 ? winAmount.toLocaleString() : bet.toLocaleString()}\n**New Balance:** $${getUser(userId).balance.toLocaleString()}`,
                        inline: false
                    });
                    
                    await interaction.update({ embeds: [embed], components: [] });
                    collector.stop();
                }
            });

            collector.on('end', () => {
                if (activeGames.has(userId)) {
                    activeGames.delete(userId);
                }
            });
        }
    }
}; 