const { EmbedBuilder } = require('discord.js');
const { getUser, createLoan } = require('../data/database');

module.exports = {
    name: 'loan',
    description: '💰 Lend money to another user with interest',
    aliases: ['lend', 'give-loan'],
    async execute(message, args) {
        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[1]);
        const userId = message.author.id;
        const user = getUser(userId);

        // Input validation
        if (!targetUser) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💰 **Invalid Recipient**')
                .setDescription('**You must mention a user to lend money to!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$loan @user <amount>`', inline: true },
                    { name: '💡 **Example**', value: '`$loan @friend 1000`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '💰 Mention someone to lend them money!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (targetUser.id === userId) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('❌ **Invalid Loan**')
                .setDescription('**You cannot lend money to yourself!**')
                .addFields(
                    { name: '💡 **Tip**', value: 'Find a friend to help with a loan!', inline: false }
                )
                .setFooter({ text: '💰 Help your friends with loans!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (isNaN(amount) || amount <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💰 **Invalid Loan Amount**')
                .setDescription('**You must provide a valid positive amount to lend!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$loan @user <amount>`', inline: true },
                    { name: '💡 **Example**', value: '`$loan @friend 1000`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '💰 Enter a valid amount to lend!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (amount > 5000) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🚫 **Loan Limit Exceeded**')
                .setDescription('**Maximum loan amount is $5,000!**')
                .addFields(
                    { name: '💰 **Maximum Loan**', value: '$5,000', inline: true },
                    { name: '💡 **Requested Amount**', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '⚠️ **Reason**', value: 'Prevents excessive debt', inline: true }
                )
                .setFooter({ text: '💰 Keep loans reasonable!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (user.balance < amount) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${amount.toLocaleString()} to make this loan!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to make loans!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Create loading animation
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 Processing Loan...')
            .setDescription('```\n⠋ Verifying loan terms...\n⠙ Processing transaction...\n⠹ Creating loan agreement...\n```')
            .addFields(
                { name: '👤 **Lender**', value: message.author.username, inline: true },
                { name: '👥 **Borrower**', value: targetUser.username, inline: true },
                { name: '💰 **Amount**', value: `$${amount.toLocaleString()}`, inline: true }
            );

        const loanMessage = await message.channel.send({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Create the loan
        const result = createLoan(userId, targetUser.id, amount);

        if (!result.success) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('❌ **Loan Failed**')
                .setDescription(`**${result.message}**`)
                .setFooter({ text: '💰 Please try again!' });
            return loanMessage.edit({ embeds: [errorEmbed] });
        }

        const loan = result.loan;
        const interest = loan.interest;
        const totalOwed = loan.totalOwed;

        // Success embed
        const successEmbed = new EmbedBuilder()
            .setColor('#00FF7F')
            .setTitle('✅ **Loan Created Successfully!**')
            .setDescription(`**${message.author.username}** has lent **$${amount.toLocaleString()}** to **${targetUser.username}**`)
            .addFields(
                {
                    name: '💰 **Loan Details**',
                    value: `**Principal:** $${amount.toLocaleString()}\n**Interest (10%):** $${interest.toLocaleString()}\n**Total Owed:** $${totalOwed.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '⏰ **Repayment Terms**',
                    value: `**Due:** <t:${Math.floor(loan.dueAt / 1000)}:R>\n**Late Fee:** Gambling blocked\n**Repay With:** \`$repay @${message.author.username}\``,
                    inline: true
                },
                {
                    name: '⚠️ **Important Notice**',
                    value: `${targetUser.username} will be **blocked from gambling** if not repaid within 24 hours!\n*Daily bonuses will still work*`,
                    inline: false
                }
            )
            .setFooter({ 
                text: `💰 Loan ID: ${loan.id} | Use $credit to view loan status`,
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await loanMessage.edit({ embeds: [successEmbed] });

        // Send DM to borrower
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('💰 **You Received a Loan!**')
                .setDescription(`**${message.author.username}** has lent you **$${amount.toLocaleString()}**!`)
                .addFields(
                    { name: '💳 **Amount Received**', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '💰 **Total to Repay**', value: `$${totalOwed.toLocaleString()}`, inline: true },
                    { name: '⏰ **Due Date**', value: `<t:${Math.floor(loan.dueAt / 1000)}:R>`, inline: true },
                    { name: '📝 **How to Repay**', value: `Use \`$repay @${message.author.username}\` in the server`, inline: false },
                    { name: '⚠️ **Warning**', value: 'You will be blocked from gambling if not repaid on time!', inline: false }
                )
                .setFooter({ text: '💰 Repay on time to avoid penalties!' });

            await targetUser.send({ embeds: [dmEmbed] });
        } catch (error) {
            // DM failed, that's okay
        }
    }
}; 