const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { readDb, writeDb } = require('../data/database');
const { createDeck, shuffleDeck, getHandValue, cardToString } = require('../utils/cards');

const activeGames = new Map();

module.exports = {
    name: 'blackjack',
    description: 'Play a game of blackjack.',
    aliases: ['bj'],
    async execute(message, args) {
        const bet = parseInt(args[0]);
        const db = readDb();
        const userId = message.author.id;

        if (isNaN(bet) || bet <= 0) {
            return message.reply('You must provide a valid positive amount to bet.');
        }

        if (!db.users[userId] || db.users[userId].balance < bet) {
            return message.reply('You do not have enough money to make that bet.');
        }

        db.users[userId].balance -= bet;
        writeDb(db);

        const deck = shuffleDeck(createDeck());
        const playerHand = [deck.pop(), deck.pop()];
        const dealerHand = [deck.pop(), deck.pop()];

        const game = {
            playerHand,
            dealerHand,
            deck,
            bet,
            userId,
        };
        
        const gameMessage = await message.channel.send({ content: 'Starting blackjack game...' });
        const gameId = gameMessage.id;
        activeGames.set(gameId, game);

        const embed = createGameEmbed(game, 'Your turn');
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`hit_${gameId}`)
                    .setLabel('Hit')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`stand_${gameId}`)
                    .setLabel('Stand')
                    .setStyle(ButtonStyle.Danger),
            );

        await gameMessage.edit({ content: '', embeds: [embed], components: [buttons] });

        const playerValue = getHandValue(playerHand);
        if (playerValue === 21) {
            endGame(gameMessage, 'blackjack');
        }
    },
    activeGames,
    createGameEmbed,
    endGame,
    getHandValue,
};

function createGameEmbed(game, status) {
    const playerHandString = game.playerHand.map(cardToString).join(' ');
    const dealerHandString = game.dealerHand.map(cardToString).join(' ');
    const playerValue = getHandValue(game.playerHand);
    const dealerValue = getHandValue(game.dealerHand);

    return new EmbedBuilder()
        .setTitle('Blackjack')
        .addFields(
            { name: 'Your Hand', value: `${playerHandString}\nValue: ${playerValue}`, inline: true },
            { name: 'Dealer Hand', value: `${dealerHandString}\nValue: ${dealerValue}`, inline: true },
        )
        .setDescription(status)
        .setColor(0x00AE86);
}

function endGame(message, result) {
    const game = activeGames.get(message.id);
    if (!game) return;

    const db = readDb();
    let resultMessage;
    let winnings = 0;
    db.users[game.userId].stats.played++;

    if (result === 'blackjack') {
        winnings = Math.floor(game.bet * 2.5);
        db.users[game.userId].balance += winnings;
        db.users[game.userId].stats.wins++;
        resultMessage = `Blackjack! You win ${winnings}!`;
    } else if (result === 'win') {
        winnings = game.bet * 2;
        db.users[game.userId].balance += winnings;
        db.users[game.userId].stats.wins++;
        resultMessage = `You win! You get ${winnings}!`;
    } else if (result === 'lose') {
        db.users[game.userId].stats.losses++;
        resultMessage = 'You lose!';
    } else if (result === 'push') {
        db.users[game.userId].balance += game.bet;
        resultMessage = 'Push! You get your bet back.';
    }

    writeDb(db);
    activeGames.delete(message.id);

    const embed = createGameEmbed(game, resultMessage);
    message.edit({ embeds: [embed], components: [] });
}

// Event listener for button interactions will be added to interactionCreate.js 