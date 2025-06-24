const { EmbedBuilder } = require('discord.js');
const { getUser, addMoney, readDb, writeDb } = require('../data/database');

module.exports = {
    name: 'daily',
    description: '🎁 Claim your daily bonus with streak multipliers!',
    aliases: ['bonus', 'claim'],
    async execute(message, args) {
        const userId = message.author.id;
        const user = getUser(userId);
        const now = Date.now();
        const cooldown = 86400000; // 24 hours in milliseconds
        
        // Check if user can claim daily
        const timeSinceLastClaim = now - user.daily.lastClaim;
        const timeUntilNext = cooldown - timeSinceLastClaim;
        
        if (timeSinceLastClaim < cooldown) {
            // Still on cooldown
            const hours = Math.floor(timeUntilNext / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));
            
            const cooldownEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('⏰ Daily Bonus Cooldown')
                .setDescription('**You\'ve already claimed your daily bonus!**')
                .addFields(
                    {
                        name: '⏱️ **Time Remaining**',
                        value: `\`\`\`${hours}h ${minutes}m\`\`\``,
                        inline: true
                    },
                    {
                        name: '🔥 **Current Streak**',
                        value: `\`\`\`${user.daily.streak} days\`\`\``,
                        inline: true
                    },
                    {
                        name: '💰 **Current Balance**',
                        value: `\`\`\`$${user.balance.toLocaleString()}\`\`\``,
                        inline: true
                    }
                )
                .setThumbnail(message.author.displayAvatarURL())
                .setFooter({ 
                    text: '🎁 Come back tomorrow for your next bonus!',
                    iconURL: message.client.user.displayAvatarURL()
                })
                .setTimestamp();
            
            return message.channel.send({ embeds: [cooldownEmbed] });
        }

        // Create loading animation
        const loadingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎁 Preparing Your Daily Bonus...')
            .setDescription('```\n⠋ Checking eligibility...\n⠙ Calculating streak bonus...\n⠹ Processing reward...\n```')
            .setThumbnail(message.author.displayAvatarURL());

        const msg = await message.channel.send({ embeds: [loadingEmbed] });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Calculate streak
        const daysSinceLastClaim = Math.floor(timeSinceLastClaim / cooldown);
        let newStreak = user.daily.streak;
        
        if (daysSinceLastClaim === 1) {
            // Consecutive day, increase streak
            newStreak += 1;
        } else if (daysSinceLastClaim > 1) {
            // Missed days, reset streak
            newStreak = 1;
        } else {
            // Same day (shouldn't happen due to cooldown check)
            newStreak = 1;
        }

        // Calculate bonus amount with streak multiplier
        const baseAmount = 1000;
        let streakMultiplier = 1;
        let bonusDescription = '';

        if (newStreak >= 30) {
            streakMultiplier = 3;
            bonusDescription = '🔥 **LEGENDARY STREAK!** 🔥';
        } else if (newStreak >= 14) {
            streakMultiplier = 2.5;
            bonusDescription = '⚡ **MEGA STREAK!** ⚡';
        } else if (newStreak >= 7) {
            streakMultiplier = 2;
            bonusDescription = '🎯 **WEEKLY STREAK!** 🎯';
        } else if (newStreak >= 3) {
            streakMultiplier = 1.5;
            bonusDescription = '🌟 **STREAK BONUS!** 🌟';
        } else {
            bonusDescription = '🎁 **DAILY BONUS!** 🎁';
        }

        const totalAmount = Math.floor(baseAmount * streakMultiplier);

        // Update user data
        const db = readDb();
        db.users[userId].daily.lastClaim = now;
        db.users[userId].daily.streak = newStreak;
        db.users[userId].balance += totalAmount;
        writeDb(db);

        // Create success embed with animation
        const successEmbed = new EmbedBuilder()
            .setColor('#00FF7F')
            .setTitle('🎉 Daily Bonus Claimed Successfully!')
            .setDescription(`${bonusDescription}\n**Congratulations ${message.author.username}!**`)
            .addFields(
                {
                    name: '💰 **Amount Received**',
                    value: `\`\`\`fix\n+$${totalAmount.toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '🔥 **Streak Bonus**',
                    value: `\`\`\`${newStreak} days (${streakMultiplier}x)\`\`\``,
                    inline: true
                },
                {
                    name: '💳 **New Balance**',
                    value: `\`\`\`fix\n$${db.users[userId].balance.toLocaleString()}\`\`\``,
                    inline: true
                }
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ 
                text: '🎁 Come back in 24 hours for your next bonus!',
                iconURL: message.client.user.displayAvatarURL()
            })
            .setTimestamp();

        // Add streak milestone rewards
        if (newStreak === 7) {
            successEmbed.addFields({
                name: '🎯 **WEEK MILESTONE!**',
                value: '```fix\nYou earned a 2x multiplier for reaching 7 days!\nKeep the streak going for even bigger bonuses!```',
                inline: false
            });
        } else if (newStreak === 14) {
            successEmbed.addFields({
                name: '⚡ **TWO WEEK MILESTONE!**',
                value: '```fix\nAmazing! You earned a 2.5x multiplier!\nYou are truly dedicated to the casino!```',
                inline: false
            });
        } else if (newStreak === 30) {
            successEmbed.addFields({
                name: '🔥 **MONTHLY MILESTONE!**',
                value: '```fix\nINCREDIBLE! You earned the maximum 3x multiplier!\nYou are a true casino legend!```',
                inline: false
            });
        }

        // Add next milestone info
        let nextMilestone = '';
        if (newStreak < 3) {
            nextMilestone = `**Next:** Reach 3 days for 1.5x bonus! (${3 - newStreak} days to go)`;
        } else if (newStreak < 7) {
            nextMilestone = `**Next:** Reach 7 days for 2x bonus! (${7 - newStreak} days to go)`;
        } else if (newStreak < 14) {
            nextMilestone = `**Next:** Reach 14 days for 2.5x bonus! (${14 - newStreak} days to go)`;
        } else if (newStreak < 30) {
            nextMilestone = `**Next:** Reach 30 days for 3x bonus! (${30 - newStreak} days to go)`;
        } else {
            nextMilestone = '**You\'ve reached the maximum streak bonus!** 🏆';
        }

        successEmbed.addFields({
            name: '🎯 **Streak Progress**',
            value: nextMilestone,
            inline: false
        });

        await msg.edit({ embeds: [successEmbed] });
    }
}; 