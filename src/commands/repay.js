const { readDb, writeDb } = require('../data/database');
const { EmbedBuilder } = require('discord.js');
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

function formatTimeRemaining(deadline) {
    const now = Date.now();
    const timeLeft = deadline - now;
    
    if (timeLeft <= 0) return 'OVERDUE';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function isLoanOverdue(deadline) {
    return Date.now() > deadline;
}

module.exports = {
    name: 'repay',
    description: 'Repay a loan to another user.',
    async execute(message, args) {
        const lender = message.mentions.users.first();
        const borrowerId = message.author.id;

        if (!lender) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('❌ Missing Lender')
                .setDescription('You must mention the user you want to repay!')
                .addFields(
                    { name: '📝 Usage', value: '`$repay @user`' }
                )
                .setFooter({ text: '🏦 Specify who you borrowed money from' });
            return message.reply({ embeds: [embed] });
        }

        const loans = readLoans();
        const loanIndex = loans.loans.findIndex(l => l.borrowerId === borrowerId && l.lenderId === lender.id && l.status === 'active');

        if (loanIndex === -1) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🔍 No Active Loan Found')
                .setDescription(`You do not have an active loan with **${lender.username}**.`)
                .addFields(
                    { name: '💡 Note', value: 'Make sure you mentioned the correct lender or check if you already repaid this loan.' }
                )
                .setThumbnail(lender.displayAvatarURL())
                .setFooter({ text: '🏦 Double-check your active loans' });
            return message.reply({ embeds: [embed] });
        }

        const loan = loans.loans[loanIndex];
        const db = readDb();
        const isOverdue = isLoanOverdue(loan.deadline);
        const timeRemaining = formatTimeRemaining(loan.deadline);

        if (db.users[borrowerId].balance < loan.repayment) {
            const shortfall = loan.repayment - db.users[borrowerId].balance;
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 Insufficient Funds')
                .setDescription(`You don't have enough money to repay this loan!`)
                .addFields(
                    { name: '💰 Required', value: `$${loan.repayment.toLocaleString()}`, inline: true },
                    { name: '💳 Your Balance', value: `$${db.users[borrowerId].balance.toLocaleString()}`, inline: true },
                    { name: '💸 Shortfall', value: `$${shortfall.toLocaleString()}`, inline: true },
                    { name: '⏰ Status', value: isOverdue ? '🚨 **OVERDUE**' : `⏳ ${timeRemaining} remaining`, inline: false },
                    { name: '💡 Earn Money', value: isOverdue ? '🚨 **You are banned from games!** Use `$daily` to earn money.' : 'Use `$daily` for free coins or play games to earn money!', inline: false }
                )
                .setThumbnail(lender.displayAvatarURL())
                .setFooter({ text: isOverdue ? '🚨 URGENT: Loan is overdue! Games are disabled!' : '💰 Earn more money to repay your loan' });
            return message.reply({ embeds: [embed] });
        }

        // Process repayment
        db.users[borrowerId].balance -= loan.repayment;
        db.users[loan.lenderId].balance += loan.repayment;

        loan.status = 'paid';
        loan.repaidAt = Date.now();

        writeDb(db);
        writeLoans(loans);

        const interestPaid = loan.repayment - loan.amount;
        const loanDuration = Math.floor((Date.now() - (loan.deadline - 24 * 60 * 60 * 1000)) / (1000 * 60 * 60));

        const embed = new EmbedBuilder()
            .setColor('#00FF7F')
            .setTitle('✅ LOAN SUCCESSFULLY REPAID! ✅')
            .setDescription(`🎉 You have successfully repaid your loan to **${lender.username}**!`)
            .addFields(
                { name: '💰 Original Loan', value: `$${loan.amount.toLocaleString()}`, inline: true },
                { name: '💸 Total Repaid', value: `$${loan.repayment.toLocaleString()}`, inline: true },
                { name: '📈 Interest Paid', value: `$${interestPaid.toLocaleString()}`, inline: true },
                { name: '💳 Your New Balance', value: `$${db.users[borrowerId].balance.toLocaleString()}`, inline: true },
                { name: '🏦 Lender Received', value: `$${loan.repayment.toLocaleString()}`, inline: true },
                { name: '📊 Interest Rate', value: '25%', inline: true },
                { name: '⏰ Loan Duration', value: `${loanDuration} hours`, inline: true },
                { name: '🎮 Game Status', value: isOverdue ? '🎉 **Games Re-enabled!**' : '✅ **Games Available**', inline: true },
                { name: '📈 Credit Score', value: isOverdue ? '📉 Late Payment' : '📈 On-time Payment', inline: true }
            )
            .setThumbnail(lender.displayAvatarURL())
            .setFooter({ text: isOverdue ? '🎊 Welcome back to the casino! Your games are now unlocked!' : '🎊 Thank you for your timely payment!' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    },
}; 