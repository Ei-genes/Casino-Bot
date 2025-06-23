const { readDb, writeDb } = require('../data/database');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
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
    name: 'credit',
    description: 'Request a loan from another user.',
    aliases: ['loan', 'borrow'],
    async execute(message, args) {
        const lender = message.mentions.users.first();
        const amount = parseInt(args[1]);
        const borrower = message.author;

        if (!lender) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('❌ Missing Lender')
                .setDescription('You must mention a user to request a loan from!')
                .addFields(
                    { name: '📝 Usage', value: '`$credit @user <amount>`' }
                )
                .setFooter({ text: '🏦 Choose someone who can afford to lend you money' });
            return message.reply({ embeds: [embed] });
        }
        if (lender.bot) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🤖 Invalid Lender')
                .setDescription('You cannot request a loan from a bot!')
                .setFooter({ text: '🏦 Bots don\'t have money to lend' });
            return message.reply({ embeds: [embed] });
        }
        if (lender.id === borrower.id) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🪞 Self-Loan Denied')
                .setDescription('You cannot request a loan from yourself!')
                .setFooter({ text: '🏦 Find someone else to lend you money' });
            return message.reply({ embeds: [embed] });
        }
        if (isNaN(amount) || amount <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 Invalid Amount')
                .setDescription('You must provide a valid positive amount for the loan!')
                .setFooter({ text: '🏦 Specify how much you want to borrow' });
            return message.reply({ embeds: [embed] });
        }

        const db = readDb();
        if (!db.users[lender.id] || db.users[lender.id].balance < amount) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💳 Insufficient Lender Funds')
                .setDescription(`**${lender.username}** does not have enough money to give you this loan.`)
                .addFields(
                    { name: '💰 Loan Requested', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '💳 Lender Balance', value: `$${db.users[lender.id]?.balance?.toLocaleString() || '0'}`, inline: true }
                )
                .setThumbnail(lender.displayAvatarURL())
                .setFooter({ text: '🏦 Try requesting a smaller amount or find another lender' });
            return message.reply({ embeds: [embed] });
        }

        // Check if borrower already has active loans
        const loans = readLoans();
        const activeLoans = loans.loans.filter(l => l.borrowerId === borrower.id && l.status === 'active');
        
        if (activeLoans.length > 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('⚠️ Active Loan Exists')
                .setDescription('You already have an active loan! You must repay it before requesting another.')
                .addFields(
                    { name: '💸 Current Debt', value: `$${activeLoans[0].repayment.toLocaleString()}`, inline: true },
                    { name: '🏦 Lender', value: `<@${activeLoans[0].lenderId}>`, inline: true }
                )
                .setFooter({ text: '🏦 Use $repay to pay off your existing loan first' });
            return message.reply({ embeds: [embed] });
        }

        const loanId = `${borrower.id}-${lender.id}-${Date.now()}`;
        const repaymentAmount = Math.floor(amount * 1.25);
        const interestAmount = repaymentAmount - amount;
        const deadline = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`acceptloan_${loanId}`)
                    .setLabel('✅ Accept Loan')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`declineloan_${loanId}`)
                    .setLabel('❌ Decline')
                    .setStyle(ButtonStyle.Danger),
            );

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏦 LOAN REQUEST 🏦')
            .setDescription(`${lender}, **${borrower.username}** is requesting a loan from you!`)
            .addFields(
                { name: '👤 Borrower', value: `${borrower.username}`, inline: true },
                { name: '💰 Loan Amount', value: `$${amount.toLocaleString()}`, inline: true },
                { name: '📈 Interest Rate', value: '25%', inline: true },
                { name: '💸 Total Repayment', value: `$${repaymentAmount.toLocaleString()}`, inline: true },
                { name: '💵 Interest Fee', value: `$${interestAmount.toLocaleString()}`, inline: true },
                { name: '⏰ Repayment Deadline', value: '24 Hours', inline: true },
                { name: '⚠️ Warning', value: 'If not repaid within 24 hours, borrower will be **banned from all games** until loan is repaid!', inline: false }
            )
            .setThumbnail(borrower.displayAvatarURL())
            .setFooter({ text: '🏦 Click Accept to approve this loan request' })
            .setTimestamp();

        await message.channel.send({
            embeds: [embed],
            components: [row],
        });
        
        loans.loans.push({
            id: loanId,
            borrowerId: borrower.id,
            lenderId: lender.id,
            amount: amount,
            repayment: repaymentAmount,
            deadline: deadline,
            status: 'pending'
        });
        writeLoans(loans);
    },
}; 