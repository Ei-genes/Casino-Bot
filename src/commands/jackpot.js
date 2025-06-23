const { EmbedBuilder } = require('discord.js');
const { readDb, writeDb } = require('../data/database');
const { readJackpot, writeJackpot } = require('../data/jackpot');

module.exports = {
    name: 'jackpot',
    description: 'Interact with the jackpot.',
    aliases: ['jp'],
    async execute(message, args) {
        const subcommand = args[0]?.toLowerCase();

        if (subcommand === 'status' || !subcommand) {
            const jackpot = readJackpot();
            const embed = new EmbedBuilder()
                .setTitle('🎰 Jackpot Status 🎰')
                .setColor('#FFD700')
                .addFields(
                    { 
                        name: '🎫 Pre-Jackpot', 
                        value: `**Tickets:** ${jackpot.preJackpot.tickets.length}/${jackpot.preJackpot.ticketsNeeded}\n**Cost per ticket:** $${jackpot.preJackpot.ticketCost}\n**Prize Pool:** $${jackpot.preJackpot.prizePool}`,
                        inline: true 
                    },
                    { 
                        name: '💰 Main Jackpot', 
                        value: `**Prize Pool:** $${jackpot.mainJackpot.prizePool.toLocaleString()}\n**Tickets Entered:** ${jackpot.mainJackpot.tickets.length}`,
                        inline: true 
                    }
                )
                .setFooter({ text: 'Good luck! 🍀' });
            await message.channel.send({ embeds: [embed] });
        } else if (subcommand === 'buy') {
            const amount = parseInt(args[1]);
            if (isNaN(amount) || amount <= 0) {
                return message.reply('You must provide a valid positive number of tickets to buy.');
            }

            const db = readDb();
            const jackpot = readJackpot();
            const userId = message.author.id;
            const cost = jackpot.preJackpot.ticketCost * amount;

            if (!db.users[userId] || db.users[userId].balance < cost) {
                return message.reply('You do not have enough money to buy these tickets.');
            }

            db.users[userId].balance -= cost;
            jackpot.preJackpot.prizePool += cost;
            for (let i = 0; i < amount; i++) {
                jackpot.preJackpot.tickets.push(userId);
            }

            writeDb(db);
            writeJackpot(jackpot);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎫 Tickets Purchased!')
                .setDescription(`You have purchased **${amount}** ticket(s) for the pre-jackpot!`)
                .addFields(
                    { name: 'Cost', value: `$${cost}`, inline: true },
                    { name: 'New Balance', value: `$${db.users[userId].balance.toLocaleString()}`, inline: true },
                    { name: 'Current Prize Pool', value: `$${jackpot.preJackpot.prizePool}`, inline: true }
                );

            await message.channel.send({ embeds: [embed] });

            if (jackpot.preJackpot.tickets.length >= jackpot.preJackpot.ticketsNeeded) {
                const winnerId = jackpot.preJackpot.tickets[Math.floor(Math.random() * jackpot.preJackpot.tickets.length)];
                jackpot.mainJackpot.tickets.push(winnerId);
                jackpot.mainJackpot.prizePool += jackpot.preJackpot.prizePool;

                try {
                    const winner = await message.client.users.fetch(winnerId);
                    const winEmbed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('🎉 Pre-Jackpot Winner! 🎉')
                        .setDescription(`Congratulations to **${winner.username}**! You have won a ticket to the main jackpot!`)
                        .setThumbnail(winner.displayAvatarURL());
                    await message.channel.send({ embeds: [winEmbed] });
                } catch {
                    await message.channel.send(`**Pre-jackpot drawn!** Congratulations to <@${winnerId}>! You have won a ticket to the main jackpot!`);
                }

                jackpot.preJackpot.tickets = [];
                jackpot.preJackpot.prizePool = 0;
                writeJackpot(jackpot);
            }
        } else {
            message.reply('Invalid subcommand. Use `$jackpot status` or `$jackpot buy <amount>`.');
        }
    },
}; 