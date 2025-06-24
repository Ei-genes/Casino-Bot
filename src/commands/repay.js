const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, getAllUserLoans, repayLoan } = require('../data/database');

module.exports = {
    name: 'repay',
    description: '💳 Repay a loan to another user',
    aliases: ['payback', 'pay-loan'],
    async execute(message, args) {
        const targetUser = message.mentions.users.first();
        const userId = message.author.id;
        const user = getUser(userId);
        const loans = getAllUserLoans(userId);

        // Check if user has any loans to repay
        if (loans.borrowed.length === 0) {
            const embed = new EmbedBuilder()
                .setColor('#4ECDC4')
                .setTitle('✅ **No Outstanding Loans**')
                .setDescription('**You have no loans to repay!**')
                .addFields(
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '🎉 **Status**', value: 'Debt-free!', inline: true },
                    { name: '💡 **Tip**', value: 'Use `$loan @user <amount>` to help friends!', inline: true }
                )
                .setFooter({ text: '💳 You\'re all caught up!' });
            return message.channel.send({ embeds: [embed] });
        }

        // If no specific user mentioned, show all loans
        if (!targetUser) {
            let loansList = '';
            loans.borrowed.forEach((loan, index) => {
                const isOverdue = Date.now() > loan.dueAt;
                const status = isOverdue ? '🔴 **OVERDUE**' : '🟢 **Active**';
                const dueText = isOverdue ? 'OVERDUE' : `<t:${Math.floor(loan.dueAt / 1000)}:R>`;
                
                loansList += `**${index + 1}.** <@${loan.lenderId}>\n`;
                loansList += `└ Amount: $${loan.totalOwed.toLocaleString()} | Due: ${dueText} | ${status}\n\n`;
            });

            const embed = new EmbedBuilder()
                .setColor(loans.overdue.length > 0 ? '#FF4757' : '#FFD700')
                .setTitle('💳 **Your Outstanding Loans**')
                .setDescription(`**You have ${loans.borrowed.length} loan(s) to repay**\n\n${loansList}`)
                .addFields(
                    { name: '📝 **How to Repay**', value: '`$repay @lender` - Repay a specific loan', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '⚠️ **Overdue Loans**', value: `${loans.overdue.length} loan(s)`, inline: true }
                )
                .setFooter({ text: '💳 Select a lender to repay!' });

            if (loans.overdue.length > 0) {
                embed.addFields({
                    name: '🚫 **Gambling Status**',
                    value: '**BLOCKED** - You cannot gamble until all overdue loans are repaid!\n*Daily bonuses still work*',
                    inline: false
                });
            }

            return message.channel.send({ embeds: [embed] });
        }

        // Find loan with specific lender
        const loanToRepay = loans.borrowed.find(loan => loan.lenderId === targetUser.id);

        if (!loanToRepay) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('❌ **No Loan Found**')
                .setDescription(`**You don't have any loans from ${targetUser.username}!**`)
                .addFields(
                    { name: '💡 **Check Your Loans**', value: 'Use `$repay` to see all your loans', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '💳 Make sure you mentioned the right lender!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (user.balance < loanToRepay.totalOwed) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${loanToRepay.totalOwed.toLocaleString()} to repay this loan!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${loanToRepay.totalOwed.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to repay your loan!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Create loading animation
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💳 Processing Repayment...')
            .setDescription('```\n⠋ Verifying loan details...\n⠙ Processing payment...\n⠹ Updating records...\n```')
            .addFields(
                { name: '👤 **Borrower**', value: message.author.username, inline: true },
                { name: '👥 **Lender**', value: targetUser.username, inline: true },
                { name: '💰 **Amount**', value: `$${loanToRepay.totalOwed.toLocaleString()}`, inline: true }
            );

        const repayMessage = await message.channel.send({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Process repayment
        const result = repayLoan(userId, loanToRepay.id);

        if (!result.success) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('❌ **Repayment Failed**')
                .setDescription(`**${result.message}**`)
                .setFooter({ text: '💳 Please try again!' });
            return repayMessage.edit({ embeds: [errorEmbed] });
        }

        const isOverdue = Date.now() > loanToRepay.dueAt;
        const updatedUser = getUser(userId);

        // Success embed
        const successEmbed = new EmbedBuilder()
            .setColor('#00FF7F')
            .setTitle('✅ **Loan Repaid Successfully!**')
            .setDescription(`**${message.author.username}** has repaid their loan to **${targetUser.username}**`)
            .addFields(
                {
                    name: '💰 **Payment Details**',
                    value: `**Principal:** $${loanToRepay.amount.toLocaleString()}\n**Interest:** $${loanToRepay.interest.toLocaleString()}\n**Total Paid:** $${loanToRepay.totalOwed.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '💳 **Account Status**',
                    value: `**New Balance:** $${updatedUser.balance.toLocaleString()}\n**Status:** ${isOverdue ? '🔴 Was Overdue' : '🟢 Paid On Time'}\n**Gambling:** ${getAllUserLoans(userId).overdue.length === 0 ? '✅ Unlocked' : '🔒 Still Blocked'}`,
                    inline: true
                },
                {
                    name: '🎉 **Congratulations!**',
                    value: `${isOverdue ? 'Better late than never!' : 'Paid on time - great job!'}\n${getAllUserLoans(userId).overdue.length === 0 ? '🎰 You can now gamble again!' : '⚠️ You still have overdue loans'}`,
                    inline: false
                }
            )
            .setFooter({ 
                text: `💳 Loan repaid successfully | Remaining loans: ${getAllUserLoans(userId).borrowed.length}`,
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await repayMessage.edit({ embeds: [successEmbed] });

        // Send DM to lender
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#00FF7F')
                .setTitle('💰 **Loan Repaid!**')
                .setDescription(`**${message.author.username}** has repaid their loan to you!`)
                .addFields(
                    { name: '💳 **Amount Received**', value: `$${loanToRepay.totalOwed.toLocaleString()}`, inline: true },
                    { name: '📈 **Interest Earned**', value: `$${loanToRepay.interest.toLocaleString()}`, inline: true },
                    { name: '⏰ **Status**', value: isOverdue ? '🔴 Late Payment' : '🟢 On Time', inline: true }
                )
                .setFooter({ text: '💰 Thanks for helping the community!' });

            await targetUser.send({ embeds: [dmEmbed] });
        } catch (error) {
            // DM failed, that's okay
        }
    }
}; 