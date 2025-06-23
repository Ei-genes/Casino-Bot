const { readDb, writeDb } = require('../data/database');
const { EmbedBuilder } = require('discord.js');

const dailyAmount = 2000;
const cooldown = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

module.exports = {
    name: 'daily',
    description: 'Claim your daily reward!',
    async execute(message, args) {
        const db = readDb();
        const userId = message.author.id;
        const now = Date.now();

        if (!db.users[userId]) {
            db.users[userId] = { balance: 0, lastDaily: 0, stats: { played: 0, wins: 0, losses: 0 } };
        }

        const lastDaily = db.users[userId].lastDaily || 0;

        if (now - lastDaily < cooldown) {
            const timeLeft = new Date(lastDaily + cooldown - now);
            const hours = timeLeft.getUTCHours();
            const minutes = timeLeft.getUTCMinutes();
            const seconds = timeLeft.getUTCSeconds();
            
            const embed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('⏰ Daily Reward Already Claimed')
                .setDescription(`You have already claimed your daily reward today!`)
                .addFields(
                    { name: '⏳ Time Remaining', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
                    { name: '💰 Next Reward', value: `$${dailyAmount.toLocaleString()}`, inline: true }
                )
                .setFooter({ text: '💡 Come back tomorrow for your next reward!' })
                .setTimestamp();
            
            return message.reply({ embeds: [embed] });
        }

        db.users[userId].balance += dailyAmount;
        db.users[userId].lastDaily = now;
        writeDb(db);

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Daily Reward Claimed! ✅')
            .setDescription(
                `🎉 ${message.author}, you've claimed your daily reward of **$${dailyAmount.toLocaleString()}**!\n\n` +
                `💰 Your new balance is **$${db.users[userId].balance.toLocaleString()}**\n\n` +
                `⏰ Come back tomorrow for another reward!`
            )
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: '💡 Tip: Use your coins to play casino games!' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    },
}; 