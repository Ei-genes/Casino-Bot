const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney, readDb, writeDb } = require('../data/database');

const suits = ['♠️', '♥️', '♦️', '♣️'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ rank, suit, value: getBaccaratValue(rank) });
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

function getBaccaratValue(rank) {
    if (['J', 'Q', 'K'].includes(rank)) return 0;
    if (rank === 'A') return 1;
    return parseInt(rank);
}

function calculateHandValue(hand) {
    let total = 0;
    for (const card of hand) {
        total += card.value;
    }
    return total % 10; // Baccarat uses modulo 10
}

function formatCard(card) {
    return `${card.rank}${card.suit}`;
}

function formatHand(hand) {
    return hand.map(formatCard).join(' ');
}

function shouldDrawThird(playerTotal, bankerTotal, playerThird = null) {
    // Player drawing rules
    if (playerTotal <= 5) {
        // Banker drawing rules when player draws
        if (playerThird !== null) {
            const thirdCardValue = playerThird.value;
            if (bankerTotal <= 2) return { player: true, banker: true };
            if (bankerTotal === 3 && thirdCardValue !== 8) return { player: true, banker: true };
            if (bankerTotal === 4 && [2, 3, 4, 5, 6, 7].includes(thirdCardValue)) return { player: true, banker: true };
            if (bankerTotal === 5 && [4, 5, 6, 7].includes(thirdCardValue)) return { player: true, banker: true };
            if (bankerTotal === 6 && [6, 7].includes(thirdCardValue)) return { player: true, banker: true };
            return { player: true, banker: false };
        }
        return { player: true, banker: bankerTotal <= 5 };
    }
    
    // Player stands, banker draws on 5 or less
    return { player: false, banker: bankerTotal <= 5 };
}

function createDealingEmbed(stage, bet, betType) {
    const dealStages = [
        { emoji: '🎴', text: 'Shuffling the cards...' },
        { emoji: '🃏', text: 'Dealing Player cards...' },
        { emoji: '🎰', text: 'Dealing Banker cards...' },
        { emoji: '🔍', text: 'Checking for naturals...' },
        { emoji: '🎯', text: 'Drawing third cards if needed...' },
        { emoji: '📊', text: 'Calculating final results...' }
    ];

    const currentStage = dealStages[stage];
    
    return new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎴 **BACCARAT TABLE** 🎴')
        .setDescription(`**Welcome to the Baccarat Table!**\n\n${currentStage.emoji} ${currentStage.text}`)
        .addFields(
            { name: '💰 **Your Bet**', value: `$${bet.toLocaleString()}`, inline: true },
            { name: '🎯 **Betting On**', value: `${betType.toUpperCase()}`, inline: true },
            { name: '🎲 **Payout**', value: getBetPayout(betType), inline: true }
        )
        .setFooter({ text: '🎴 The cards are being dealt... Good luck!' });
}

function getBetPayout(betType) {
    switch (betType) {
        case 'player': return '1:1';
        case 'banker': return '0.95:1 (5% commission)';
        case 'tie': return '8:1';
        default: return '1:1';
    }
}

function createResultEmbed(game, bet, betType, winAmount, newBalance, user) {
    const playerTotal = calculateHandValue(game.playerHand);
    const bankerTotal = calculateHandValue(game.bankerHand);
    
    let winner = '';
    if (playerTotal > bankerTotal) winner = 'PLAYER';
    else if (bankerTotal > playerTotal) winner = 'BANKER';
    else winner = 'TIE';
    
    const isWin = winAmount > 0;
    const embedColor = isWin ? '#00FF7F' : '#FF4757';
    
    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(isWin ? '🎉 **BACCARAT WIN!** 🎉' : '💸 **BACCARAT RESULT** 💸')
        .setDescription(`**${winner} WINS!**\n\n${isWin ? `🎊 **Congratulations! You won $${winAmount.toLocaleString()}!** 🎊` : `💸 **Better luck next time! You lost $${bet.toLocaleString()}.**`}`)
        .addFields(
            {
                name: '👤 **Player Hand**',
                value: `${formatHand(game.playerHand)}\n**Total: ${playerTotal}**`,
                inline: true
            },
            {
                name: '🏦 **Banker Hand**',
                value: `${formatHand(game.bankerHand)}\n**Total: ${bankerTotal}**`,
                inline: true
            },
            {
                name: '🏆 **Winner**',
                value: `**${winner}**`,
                inline: true
            },
            {
                name: '🎯 **Your Bet**',
                value: `${betType.toUpperCase()}: $${bet.toLocaleString()}`,
                inline: true
            },
            {
                name: '💰 **Result**',
                value: isWin ? `🎉 **WON $${winAmount.toLocaleString()}!**` : `💸 **Lost $${bet.toLocaleString()}**`,
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
            text: isWin ? '🎉 Excellent prediction! Play again!' : '🎴 Try your luck again at the Baccarat table!',
        })
        .setTimestamp();

    // Add game rules
    embed.addFields({
        name: '🎴 **Baccarat Rules**',
        value: '**Player:** Bet on player hand (1:1)\n**Banker:** Bet on banker hand (0.95:1)\n**Tie:** Bet on tie (8:1)\n\n*Closest to 9 wins! Face cards = 0, Ace = 1*',
        inline: false
    });

    return embed;
}

function calculateWinAmount(bet, betType, winner) {
    if (betType === 'player' && winner === 'PLAYER') {
        return bet * 2; // 1:1 payout + original bet
    } else if (betType === 'banker' && winner === 'BANKER') {
        return Math.floor(bet * 1.95); // 0.95:1 payout + original bet (5% commission)
    } else if (betType === 'tie' && winner === 'TIE') {
        return bet * 9; // 8:1 payout + original bet
    }
    return 0; // Loss
}

module.exports = {
    name: 'baccarat',
    description: '🎴 Play classic Baccarat - Player vs Banker!',
    aliases: ['bacc', 'bac'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const betType = args[1]?.toLowerCase();
        const userId = message.author.id;
        const user = getUser(userId);

        // Input validation
        if (isNaN(bet) || bet <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🎴 **Invalid Bet Amount**')
                .setDescription('**You must provide a valid positive amount to bet!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$baccarat <amount> <type>`', inline: true },
                    { name: '💡 **Examples**', value: '`$baccarat 100 player`\n`$baccarat 50 banker`\n`$baccarat 200 tie`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '🎴 Place your bet at the Baccarat table!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!betType || !['player', 'banker', 'tie'].includes(betType)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🎴 **Invalid Bet Type**')
                .setDescription('**You must choose what to bet on!**')
                .addFields(
                    { name: '🎯 **Bet Options**', value: '**`player`** - Bet on Player hand (1:1)\n**`banker`** - Bet on Banker hand (0.95:1)\n**`tie`** - Bet on Tie (8:1)', inline: false },
                    { name: '💡 **Examples**', value: '`$baccarat 100 player`\n`$baccarat 50 banker`\n`$baccarat 25 tie`', inline: false }
                )
                .setFooter({ text: '🎴 Choose player, banker, or tie!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, bet)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${bet.toLocaleString()} to play Baccarat!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${bet.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to play Baccarat!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Start dealing animation
        const dealMessage = await message.channel.send({ 
            embeds: [createDealingEmbed(0, bet, betType)] 
        });
        
        // Animate the dealing
        for (let i = 1; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 1200));
            await dealMessage.edit({ 
                embeds: [createDealingEmbed(i, bet, betType)] 
            });
        }

        // Create and shuffle deck
        const deck = createDeck();
        
        // Deal initial hands
        const game = {
            playerHand: [deck.pop(), deck.pop()],
            bankerHand: [deck.pop(), deck.pop()]
        };

        // Calculate initial totals
        let playerTotal = calculateHandValue(game.playerHand);
        let bankerTotal = calculateHandValue(game.bankerHand);

        // Check for naturals (8 or 9)
        const playerNatural = playerTotal >= 8;
        const bankerNatural = bankerTotal >= 8;

        // Draw third cards if needed (and no naturals)
        if (!playerNatural && !bankerNatural) {
            const drawRules = shouldDrawThird(playerTotal, bankerTotal);
            let playerThirdCard = null;
            
            if (drawRules.player) {
                playerThirdCard = deck.pop();
                game.playerHand.push(playerThirdCard);
                playerTotal = calculateHandValue(game.playerHand);
            }
            
            if (drawRules.banker) {
                game.bankerHand.push(deck.pop());
                bankerTotal = calculateHandValue(game.bankerHand);
            }
        }

        // Determine winner
        let winner = '';
        if (playerTotal > bankerTotal) winner = 'PLAYER';
        else if (bankerTotal > playerTotal) winner = 'BANKER';
        else winner = 'TIE';

        // Process bet
        removeMoney(userId, bet);
        const winAmount = calculateWinAmount(bet, betType, winner);
        
        if (winAmount > 0) {
            addMoney(userId, winAmount);
        }

        // Update stats
        const db = readDb();
        db.users[userId].stats.gamesPlayed++;
        if (winAmount > 0) {
            db.users[userId].stats.gamesWon++;
            if (winAmount > db.users[userId].stats.biggestWin) {
                db.users[userId].stats.biggestWin = winAmount;
            }
        }
        writeDb(db);

        // Show final result
        await new Promise(resolve => setTimeout(resolve, 1500));
        const updatedUser = getUser(userId);
        const resultEmbed = createResultEmbed(game, bet, betType, winAmount, updatedUser.balance, message.author);
        await dealMessage.edit({ embeds: [resultEmbed] });
    }
}; 