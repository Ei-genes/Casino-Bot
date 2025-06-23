const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const activeConnect4Games = new Map();

module.exports = {
    name: 'connect4',
    description: 'Challenge another player to a game of Connect 4.',
    aliases: ['c4'],
    async execute(message, args) {
        const opponent = message.mentions.users.first();
        const challenger = message.author;

        if (!opponent) {
            return message.reply('You must mention a user to challenge.');
        }
        if (opponent.bot) {
            return message.reply('You cannot challenge a bot.');
        }
        if (opponent.id === challenger.id) {
            return message.reply('You cannot challenge yourself.');
        }

        const gameId = `${challenger.id}-${opponent.id}`;
        if (activeConnect4Games.has(gameId)) {
            return message.reply('You already have an active game with this user.');
        }

        const game = {
            board: createBoard(),
            players: [challenger.id, opponent.id],
            turn: challenger.id,
            pieces: ['🔴', '🟡'],
        };
        activeConnect4Games.set(gameId, game);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_${gameId}`)
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`decline_${gameId}`)
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger),
            );

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔴 Connect 4 Challenge! 🟡')
            .setDescription(`${opponent}, you have been challenged to a game of Connect 4 by ${challenger}!`)
            .addFields(
                { name: 'Challenger', value: challenger.username, inline: true },
                { name: 'Opponent', value: opponent.username, inline: true }
            )
            .setThumbnail(challenger.displayAvatarURL());

        await message.channel.send({
            embeds: [embed],
            components: [row],
        });
    },
    activeConnect4Games,
};

function createBoard() {
    return Array(6).fill(null).map(() => Array(7).fill('⚫'));
}

function boardToString(board) {
    return board.map(row => row.join(' ')).join('\n');
}

function createGameMessage(game) {
    const embed = new EmbedBuilder()
        .setTitle('🔴 Connect 4 🟡')
        .setDescription(boardToString(game.board))
        .setColor('#5865F2')
        .setFooter({ text: `Turn: Player ${game.players.indexOf(game.turn) + 1} (${game.pieces[game.players.indexOf(game.turn)]})` });

    const buttons = new ActionRowBuilder();
    for (let i = 0; i < 7; i++) {
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`c4_${i}_${game.gameId}`)
                .setLabel(`${i + 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(game.board[0][i] !== '⚫'),
        );
    }
    return { embeds: [embed], components: [buttons] };
}

function checkWin(board, playerPiece) {
    // Check horizontal
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
            if (board[row][col] === playerPiece && board[row][col + 1] === playerPiece && board[row][col + 2] === playerPiece && board[row][col + 3] === playerPiece) {
                return true;
            }
        }
    }
    // Check vertical
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 7; col++) {
            if (board[row][col] === playerPiece && board[row + 1][col] === playerPiece && board[row + 2][col] === playerPiece && board[row + 3][col] === playerPiece) {
                return true;
            }
        }
    }
    // Check diagonal (down-right)
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            if (board[row][col] === playerPiece && board[row + 1][col + 1] === playerPiece && board[row + 2][col + 2] === playerPiece && board[row + 3][col + 3] === playerPiece) {
                return true;
            }
        }
    }
    // Check diagonal (up-right)
    for (let row = 3; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
            if (board[row][col] === playerPiece && board[row - 1][col + 1] === playerPiece && board[row - 2][col + 2] === playerPiece && board[row - 3][col + 3] === playerPiece) {
                return true;
            }
        }
    }
    return false;
}

module.exports.createGameMessage = createGameMessage;
module.exports.checkWin = checkWin; 