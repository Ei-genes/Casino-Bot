const { EmbedBuilder } = require('discord.js');
const { getUser, canAfford, addMoney, removeMoney } = require('../data/database');

module.exports = {
    name: 'transfer',
    description: '💸 Transfer money to another user',
    aliases: ['send', 'give', 'pay'],
    async execute(message, args) {
        const targetUser = message.mentions.users.first();
        const amount = parseInt(args[1]);
        const userId = message.author.id;
        const user = getUser(userId);

        // Input validation
        if (!targetUser) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Invalid Recipient**')
                .setDescription('**You must mention a user to transfer money to!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$transfer @user <amount>`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '💸 Mention someone to send them money!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (targetUser.id === userId) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('❌ **Invalid Transfer**')
                .setDescription('**You cannot transfer money to yourself!**')
                .addFields(
                    { name: '💡 **Tip**', value: 'Find a friend to send money to instead!', inline: false }
                )
                .setFooter({ text: '💸 Transfer money to help your friends!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (targetUser.bot) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('🤖 **Invalid Recipient**')
                .setDescription('**You cannot transfer money to bots!**')
                .addFields(
                    { name: '💡 **Tip**', value: 'Only real users can receive money transfers!', inline: false }
                )
                .setFooter({ text: '💸 Find a human friend to send money to!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (isNaN(amount) || amount <= 0) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Invalid Amount**')
                .setDescription('**You must provide a valid positive amount to transfer!**')
                .addFields(
                    { name: '📝 **Usage**', value: '`$transfer @user <amount>`', inline: true },
                    { name: '💰 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '💸 Enter a valid amount to transfer!' });
            return message.channel.send({ embeds: [embed] });
        }

        if (!canAfford(userId, amount)) {
            const embed = new EmbedBuilder()
                .setColor('#FF4757')
                .setTitle('💸 **Insufficient Funds**')
                .setDescription(`**You need $${amount.toLocaleString()} to make this transfer!**`)
                .addFields(
                    { name: '💰 **Required**', value: `$${amount.toLocaleString()}`, inline: true },
                    { name: '💳 **Your Balance**', value: `$${user.balance.toLocaleString()}`, inline: true },
                    { name: '💡 **Tip**', value: 'Use `$daily` to get free coins!', inline: true }
                )
                .setFooter({ text: '💰 Earn more money to make transfers!' });
            return message.channel.send({ embeds: [embed] });
        }

        // Create loading animation
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💸 Processing Transfer...')
            .setDescription('```\n⠋ Verifying transaction...\n⠙ Processing payment...\n⠹ Updating accounts...\n```')
            .addFields(
                { name: '👤 **From**', value: message.author.username, inline: true },
                { name: '👥 **To**', value: targetUser.username, inline: true },
                { name: '💰 **Amount**', value: `$${amount.toLocaleString()}`, inline: true }
            );

        const transferMessage = await message.channel.send({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Process the transfer
        removeMoney(userId, amount);
        addMoney(targetUser.id, amount);

        // Get updated balances
        const senderUpdated = getUser(userId);
        const recipientUpdated = getUser(targetUser.id);

        // Create success embed
        const successEmbed = new EmbedBuilder()
            .setColor('#00FF7F')
            .setTitle('✅ **Transfer Successful!**')
            .setDescription(`**${message.author.username}** successfully sent **$${amount.toLocaleString()}** to **${targetUser.username}**!`)
            .addFields(
                {
                    name: '👤 **Sender**',
                    value: `${message.author.username}\n💳 New Balance: $${senderUpdated.balance.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '👥 **Recipient**',
                    value: `${targetUser.username}\n💳 New Balance: $${recipientUpdated.balance.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '💸 **Transfer Details**',
                    value: `**Amount:** $${amount.toLocaleString()}\n**Date:** ${new Date().toLocaleString()}`,
                    inline: true
                }
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ 
                text: '💸 Transfer completed successfully!',
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await transferMessage.edit({ embeds: [successEmbed] });

        // Send notification to recipient if they're in the same channel
        try {
            const notificationEmbed = new EmbedBuilder()
                .setColor('#00FF7F')
                .setTitle('💰 **Money Received!**')
                .setDescription(`**You received $${amount.toLocaleString()} from ${message.author.username}!**`)
                .addFields(
                    { name: '💳 **Your New Balance**', value: `$${recipientUpdated.balance.toLocaleString()}`, inline: true },
                    { name: '👤 **From**', value: message.author.username, inline: true },
                    { name: '💰 **Amount**', value: `$${amount.toLocaleString()}`, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setFooter({ text: '💰 Enjoy your money!' })
                .setTimestamp();

            // Try to send DM, if it fails, mention in channel
            try {
                await targetUser.send({ embeds: [notificationEmbed] });
            } catch {
                // DM failed, mention in channel
                await message.channel.send({
                    content: `${targetUser}, you received money!`,
                    embeds: [notificationEmbed]
                });
            }
        } catch (error) {
            // Notification failed, but transfer was successful
            console.log('Failed to send transfer notification:', error);
        }
    }
}; 