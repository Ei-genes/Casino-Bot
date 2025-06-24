const { EmbedBuilder } = require('discord.js');
const { getUser, getAllUserLoans } = require('../data/database');

module.exports = {
    name: 'credit',
    description: '📊 View your loan status and credit information',
    aliases: ['loans', 'debt', 'loan-status'],
    async execute(message, args) {
        const userId = message.author.id;
        const user = getUser(userId);
        const loans = getAllUserLoans(userId);

        // Create loading animation
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('📊 Loading Credit Report...')
            .setDescription('```\n⠋ Accessing loan database...\n⠙ Calculating totals...\n⠹ Preparing report...\n```')
            .setThumbnail(message.author.displayAvatarURL());

        const msg = await message.channel.send({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Calculate totals
        const totalBorrowed = loans.borrowed.reduce((sum, loan) => sum + loan.totalOwed, 0);
        const totalLent = loans.lent.reduce((sum, loan) => sum + loan.totalOwed, 0);
        const overdueCount = loans.overdue.length;
        const isBlocked = overdueCount > 0;

        // Determine credit status
        let creditStatus = '🟢 **Excellent**';
        let creditColor = '#00FF7F';
        
        if (overdueCount > 0) {
            creditStatus = '🔴 **Poor - Overdue Loans**';
            creditColor = '#FF4757';
        } else if (loans.borrowed.length > 3) {
            creditStatus = '🟡 **Fair - High Debt**';
            creditColor = '#FFD700';
        } else if (loans.borrowed.length > 0) {
            creditStatus = '🟠 **Good - Active Loans**';
            creditColor = '#FFA500';
        }

        const creditEmbed = new EmbedBuilder()
            .setColor(creditColor)
            .setTitle(`📊 ${message.author.username}'s Credit Report`)
            .setDescription(`**Credit Status:** ${creditStatus}\n**Gambling Access:** ${isBlocked ? '🔒 **BLOCKED**' : '✅ **Available**'}`)
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                {
                    name: '💰 **Financial Overview**',
                    value: `**Current Balance:** $${user.balance.toLocaleString()}\n**Total Debt:** $${totalBorrowed.toLocaleString()}\n**Total Lent:** $${totalLent.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '📈 **Loan Summary**',
                    value: `**Active Loans:** ${loans.borrowed.length}\n**Loans Given:** ${loans.lent.length}\n**Overdue Loans:** ${overdueCount}`,
                    inline: true
                },
                {
                    name: '🎯 **Net Position**',
                    value: `**Net Amount:** ${totalLent - totalBorrowed >= 0 ? '+' : ''}$${(totalLent - totalBorrowed).toLocaleString()}\n**Status:** ${totalLent > totalBorrowed ? 'Creditor' : totalBorrowed > totalLent ? 'Debtor' : 'Neutral'}`,
                    inline: true
                }
            );

        // Add borrowed loans section
        if (loans.borrowed.length > 0) {
            let borrowedList = '';
            loans.borrowed.forEach((loan, index) => {
                const isOverdue = Date.now() > loan.dueAt;
                const status = isOverdue ? '🔴 **OVERDUE**' : '🟢 **Active**';
                const dueText = isOverdue ? '**OVERDUE**' : `<t:${Math.floor(loan.dueAt / 1000)}:R>`;
                
                borrowedList += `**${index + 1}.** <@${loan.lenderId}>\n`;
                borrowedList += `└ $${loan.totalOwed.toLocaleString()} due ${dueText} ${status}\n`;
            });

            creditEmbed.addFields({
                name: '💸 **Your Borrowed Loans**',
                value: borrowedList,
                inline: false
            });
        }

        // Add lent loans section
        if (loans.lent.length > 0) {
            let lentList = '';
            loans.lent.forEach((loan, index) => {
                const isOverdue = Date.now() > loan.dueAt;
                const status = isOverdue ? '🔴 **OVERDUE**' : '🟢 **Active**';
                const dueText = isOverdue ? '**OVERDUE**' : `<t:${Math.floor(loan.dueAt / 1000)}:R>`;
                
                lentList += `**${index + 1}.** <@${loan.borrowerId}>\n`;
                lentList += `└ $${loan.totalOwed.toLocaleString()} due ${dueText} ${status}\n`;
            });

            creditEmbed.addFields({
                name: '💰 **Your Lent Money**',
                value: lentList,
                inline: false
            });
        }

        // Add special warnings or notices
        if (isBlocked) {
            creditEmbed.addFields({
                name: '🚫 **Gambling Restriction**',
                value: '**You are BLOCKED from gambling due to overdue loans!**\n• Repay overdue loans to unlock gambling\n• Daily bonuses still work\n• Use `$repay @lender` to pay back loans',
                inline: false
            });
        }

        if (loans.borrowed.length === 0 && loans.lent.length === 0) {
            creditEmbed.addFields({
                name: '✨ **Clean Slate**',
                value: '**You have no active loans!**\n• Perfect credit status\n• No debt or obligations\n• Ready to help friends with `$loan @user <amount>`',
                inline: false
            });
        }

        // Add helpful commands
        let commandsList = '';
        if (loans.borrowed.length > 0) {
            commandsList += '`$repay @lender` - Repay a specific loan\n';
        }
        if (user.balance >= 100) {
            commandsList += '`$loan @user <amount>` - Lend money to friends\n';
        }
        commandsList += '`$transfer @user <amount>` - Send money directly';

        creditEmbed.addFields({
            name: '💡 **Available Commands**',
            value: commandsList,
            inline: false
        });

        creditEmbed.setFooter({ 
            text: `📊 Credit Report | Interest Rate: 10% | Max Loan: $5,000`,
            iconURL: message.client.user.displayAvatarURL()
        }).setTimestamp();

        await msg.edit({ embeds: [creditEmbed] });
    }
}; 