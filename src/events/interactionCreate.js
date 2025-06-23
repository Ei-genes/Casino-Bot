const blackjack = require('../commands/blackjack');
const connect4 = require('../commands/connect4');
const { readDb, writeDb } = require('../data/database');
const fs = require('fs');
const path = require('path');
const loansPath = path.join(__dirname, '../data/loans.json');

function readLoans() {
    try {
        const data = fs.readFileSync(loansPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { loans: [] };
    }
}

function writeLoans(data) {
    fs.writeFileSync(loansPath, JSON.stringify(data, null, 2));
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        } else if (interaction.isButton()) {
            const [action, ...args] = interaction.customId.split('_');
            
            if (action === 'hit' || action === 'stand') {
                const gameId = args[0];
                const game = blackjack.activeGames.get(gameId);

                if (!game) return;

                if (action === 'hit') {
                    game.playerHand.push(game.deck.pop());
                    const playerValue = blackjack.getHandValue(game.playerHand);
                    if (playerValue > 21) {
                        blackjack.endGame(interaction.message, 'lose');
                    } else {
                        const embed = blackjack.createGameEmbed(game, 'Your turn');
                        interaction.update({ embeds: [embed] });
                    }
                } else if (action === 'stand') {
                    while (blackjack.getHandValue(game.dealerHand) < 17) {
                        game.dealerHand.push(game.deck.pop());
                    }
                    const playerValue = blackjack.getHandValue(game.playerHand);
                    const dealerValue = blackjack.getHandValue(game.dealerHand);

                    if (dealerValue > 21 || playerValue > dealerValue) {
                        blackjack.endGame(interaction.message, 'win');
                    } else if (playerValue < dealerValue) {
                        blackjack.endGame(interaction.message, 'lose');
                    } else {
                        blackjack.endGame(interaction.message, 'push');
                    }
                }
            } else if (action === 'accept' || action === 'decline') {
                const gameId = args.join('_');
                const game = connect4.activeConnect4Games.get(gameId);
                if (!game || game.players.includes(interaction.user.id)) {
                    if (action === 'accept') {
                        game.gameId = gameId;
                        const message = connect4.createGameMessage(game);
                        interaction.update({ content: 'Game started!', ...message });
                    } else {
                        connect4.activeConnect4Games.delete(gameId);
                        interaction.update({ content: 'Game declined.', components: [] });
                    }
                }
            } else if (action === 'c4') {
                const [col, gameId] = args;
                const game = connect4.activeConnect4Games.get(gameId);
                if (!game || game.turn !== interaction.user.id) return;

                const colNum = parseInt(col);
                for (let row = 5; row >= 0; row--) {
                    if (game.board[row][colNum] === '⚫') {
                        const playerIndex = game.players.indexOf(interaction.user.id);
                        game.board[row][colNum] = game.pieces[playerIndex];
                        
                        if (connect4.checkWin(game.board, game.pieces[playerIndex])) {
                            connect4.activeConnect4Games.delete(gameId);
                            interaction.update({ content: `<@${interaction.user.id}> wins!`, components: [] });
                        } else {
                            game.turn = game.players[(playerIndex + 1) % 2];
                            const message = connect4.createGameMessage(game);
                            interaction.update(message);
                        }
                        return;
                    }
                }
            } else if (action === 'acceptloan' || action === 'declineloan') {
                const loanId = args[0];
                const loans = readLoans();
                const loan = loans.loans.find(l => l.id === loanId);
                
                if (!loan || loan.lenderId !== interaction.user.id) return;
                
                if (action === 'acceptloan') {
                    const db = readDb();
                    db.users[loan.lenderId].balance -= loan.amount;
                    db.users[loan.borrowerId].balance += loan.amount;
                    loan.status = 'active';
                    writeDb(db);
                    writeLoans(loans);
                    interaction.update({ content: 'Loan accepted!', components: [] });
                } else {
                    loan.status = 'declined';
                    writeLoans(loans);
                    interaction.update({ content: 'Loan declined.', components: [] });
                }
            }
        }
    },
}; 