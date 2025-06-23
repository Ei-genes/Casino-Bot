const { readDb, writeDb, checkOverdueLoans } = require('../data/database');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const lottoPath = path.join(__dirname, '../data/lotto.json');

const ticketCost = 100;
const numberRange = 100;
const jackpotContribution = 50; // $50 from each ticket goes to jackpot
const basePrizes = {
    close: 2500,      // ±1 number (fixed)
    near: 500,        // ±2-3 numbers (fixed)
    participation: 150 // ±4-10 numbers (fixed)
};

function readLotto() {
    try {
        const data = fs.readFileSync(lottoPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { 
            jackpotPool: 10000, // Starting jackpot
            totalTicketsSold: 0,
            totalPayout: 0,
            recentWinners: [],
            stats: {
                jackpots: 0,
                closeWins: 0,
                nearWins: 0,
                participationWins: 0
            }
        };
    }
}

function writeLotto(data) {
    fs.writeFileSync(lottoPath, JSON.stringify(data, null, 2));
}

function getWinResult(guess, winning, currentJackpot) {
    const diff = Math.abs(guess - winning);
    
    if (diff === 0) return { type: 'jackpot', amount: currentJackpot, message: '🎊 JACKPOT WINNER! 🎊' };
    if (diff === 1) return { type: 'close', amount: basePrizes.close, message: '🔥 SO CLOSE! 🔥' };
    if (diff <= 3) return { type: 'near', amount: basePrizes.near, message: '⚡ NEAR MISS! ⚡' };
    if (diff <= 10) return { type: 'participation', amount: basePrizes.participation, message: '🎁 CONSOLATION! 🎁' };
    
    return { type: 'loss', amount: 0, message: '💸 Better luck next time!' };
}

function createAnimatedEmbed(guess, winning, result, user, newBalance, stats, currentJackpot, nextJackpot) {
    const colors = {
        jackpot: '#FFD700',
        close: '#FF6B35',
        near: '#4ECDC4',
        participation: '#45B7D1',
        loss: '#FF6B6B'
    };

    const embed = new EmbedBuilder()
        .setColor(colors[result.type])
        .setTitle('🎰 INSTANT LOTTERY DRAW 🎰')
        .setDescription(`🎲 **Drawing numbers...** 🎲\n\n🔮 **Your Number:** ${guess}\n🎯 **Winning Number:** ${winning}\n\n${result.message}`)
        .setThumbnail(user.displayAvatarURL());

    if (result.type === 'jackpot') {
        embed.addFields(
            { name: '🎊 JACKPOT WON!', value: `$${result.amount.toLocaleString()}`, inline: true },
            { name: '💳 New Balance', value: `$${newBalance.toLocaleString()}`, inline: true },
            { name: '🎯 Perfect Match!', value: `Exact number!`, inline: true },
            { name: '🆕 New Jackpot', value: `$${nextJackpot.toLocaleString()}`, inline: false }
        );
    } else if (result.type !== 'loss') {
        embed.addFields(
            { name: '💰 Prize Won', value: `$${result.amount.toLocaleString()}`, inline: true },
            { name: '💳 New Balance', value: `$${newBalance.toLocaleString()}`, inline: true },
            { name: '�� Difference', value: `${Math.abs(guess - winning)} numbers`, inline: true },
            { name: '🎰 Current Jackpot', value: `$${nextJackpot.toLocaleString()}`, inline: false }
        );
    } else {
        embed.addFields(
            { name: '💸 Lost', value: `$${ticketCost}`, inline: true },
            { name: '💳 New Balance', value: `$${newBalance.toLocaleString()}`, inline: true },
            { name: '📊 Difference', value: `${Math.abs(guess - winning)} numbers`, inline: true },
            { name: '🎰 Current Jackpot', value: `$${nextJackpot.toLocaleString()} (+$${jackpotContribution})`, inline: false }
        );
    }

    // Add visual number line
    const createNumberLine = (guess, winning) => {
        const range = 8;
        const start = Math.max(1, Math.min(guess, winning) - range);
        const end = Math.min(numberRange, Math.max(guess, winning) + range);
        
        let line = '';
        for (let i = start; i <= end; i++) {
            if (i === guess && i === winning) {
                line += '🎯'; // Exact match
            } else if (i === guess) {
                line += '🔵'; // Your guess
            } else if (i === winning) {
                line += '🟡'; // Winning number
            } else {
                line += '⚫';
            }
        }
        return line;
    };

    embed.addFields({
        name: '📈 Number Line',
        value: `${createNumberLine(guess, winning)}\n🔵 Your Pick | 🟡 Winner | 🎯 Match`,
        inline: false
    });

    // Add prize structure
    embed.addFields({
        name: '💰 Prize Structure',
        value: `🎊 Jackpot: $${nextJackpot.toLocaleString()} (exact)\n🔥 Close: $${basePrizes.close.toLocaleString()} (±1)\n⚡ Near: $${basePrizes.near.toLocaleString()} (±2-3)\n🎁 Consolation: $${basePrizes.participation.toLocaleString()} (±4-10)`,
        inline: true
    });

    // Add lottery stats
    embed.addFields({
        name: '📊 Win Statistics',
        value: `🎊 Jackpots: ${stats.jackpots}\n🔥 Close: ${stats.closeWins}\n⚡ Near: ${stats.nearWins}\n🎁 Consolation: ${stats.participationWins}`,
        inline: true
    });

    embed.setFooter({ 
        text: result.type === 'jackpot' ? '🎉 CONGRATULATIONS ON THE JACKPOT!' : 
              result.type !== 'loss' ? '🎉 Congratulations on your win!' : 
              `🍀 Jackpot grows by $${jackpotContribution} with each ticket!`
    });
    
    embed.setTimestamp();
    
    return embed;
}

module.exports = {
    name: 'lotto',
    description: 'Play instant lottery! Growing jackpot starts at $10,000!',
    aliases: ['lottery'],
    async execute(message, args) {
        const guess = parseInt(args[0]);
        const userId = message.author.id;

        // Check for overdue loans
        const loanCheck = checkOverdueLoans(userId);
        if (loanCheck.hasOverdueLoans) {
            const overdueLoan = loanCheck.overdueLoans[0];
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🚨 GAMES DISABLED 🚨')
                .setDescription('You have an overdue loan! All games are disabled until you repay it.')
                .addFields(
                    { name: '💸 Overdue Amount', value: `$${overdueLoan.repayment.toLocaleString()}`, inline: true },
                    { name: '🏦 Lender', value: `<@${overdueLoan.lenderId}>`, inline: true },
                    { name: '⏰ Overdue Since', value: new Date(overdueLoan.deadline).toLocaleString(), inline: false },
                    { name: '💰 How to Repay', value: 'Use `$daily` to earn money, then `$repay @lender`' }
                )
                .setFooter({ text: '🚨 Pay your debts to unlock games!' });
            return message.reply({ embeds: [embed] });
        }

        // Input validation with styled embeds
        if (isNaN(guess) || guess < 1 || guess > numberRange) {
            const lotto = readLotto();
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ Invalid Number')
                .setDescription(`You must guess a number between **1** and **${numberRange}**!`)
                .addFields(
                    { name: '📝 Usage', value: '`$lotto <number>`' },
                    { name: '🎫 Ticket Cost', value: `$${ticketCost}` },
                    { name: '🎰 Current Jackpot', value: `$${lotto.jackpotPool.toLocaleString()}` }
                )
                .setFooter({ text: '🎰 Pick your lucky number and win the growing jackpot!' });
            return message.reply({ embeds: [embed] });
        }

        const db = readDb();
        if (!db.users[userId]) {
            db.users[userId] = { balance: 0, lastDaily: 0, stats: { played: 0, wins: 0, losses: 0 } };
        }

        if (db.users[userId].balance < ticketCost) {
            const lotto = readLotto();
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('💸 Insufficient Funds')
                .setDescription(`You need **$${ticketCost}** to buy a lottery ticket!`)
                .addFields(
                    { name: '💰 Required', value: `$${ticketCost}`, inline: true },
                    { name: '💳 Your Balance', value: `$${db.users[userId].balance.toLocaleString()}`, inline: true },
                    { name: '🎰 Current Jackpot', value: `$${lotto.jackpotPool.toLocaleString()}`, inline: true },
                    { name: '💡 Tip', value: 'Use `$daily` to get free coins!' }
                )
                .setFooter({ text: '💰 Earn more coins to play for the jackpot!' });
            return message.reply({ embeds: [embed] });
        }

        // Deduct ticket cost
        db.users[userId].balance -= ticketCost;
        
        // Load current lottery state
        const lotto = readLotto();
        const currentJackpot = lotto.jackpotPool;
        
        // Generate winning number
        const winningNumber = Math.floor(Math.random() * numberRange) + 1;
        
        // Calculate result
        const result = getWinResult(guess, winningNumber, currentJackpot);
        
        // Update stats
        db.users[userId].stats.played++;
        lotto.totalTicketsSold++;
        
        if (result.type === 'jackpot') {
            // Jackpot won! Reset to base amount
            db.users[userId].balance += result.amount;
            db.users[userId].stats.wins++;
            lotto.totalPayout += result.amount;
            lotto.stats.jackpots++;
            lotto.jackpotPool = 10000; // Reset jackpot
            
            // Add to recent winners
            lotto.recentWinners.unshift({
                username: message.author.username,
                amount: result.amount,
                type: result.type,
                timestamp: Date.now()
            });
        } else {
            // Add to jackpot pool
            lotto.jackpotPool += jackpotContribution;
            
            if (result.type !== 'loss') {
                db.users[userId].balance += result.amount;
                db.users[userId].stats.wins++;
                lotto.totalPayout += result.amount;
                lotto.stats[result.type === 'close' ? 'closeWins' : result.type === 'near' ? 'nearWins' : 'participationWins']++;
                
                // Add to recent winners
                lotto.recentWinners.unshift({
                    username: message.author.username,
                    amount: result.amount,
                    type: result.type,
                    timestamp: Date.now()
                });
            } else {
                db.users[userId].stats.losses++;
            }
        }
        
        // Keep only last 10 winners
        if (lotto.recentWinners.length > 10) {
            lotto.recentWinners = lotto.recentWinners.slice(0, 10);
        }

        writeDb(db);
        writeLotto(lotto);

        // Create and send result embed
        const resultEmbed = createAnimatedEmbed(guess, winningNumber, result, message.author, db.users[userId].balance, lotto.stats, currentJackpot, lotto.jackpotPool);
        await message.channel.send({ embeds: [resultEmbed] });
    },
}; 