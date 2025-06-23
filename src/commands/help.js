const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Displays all available commands.',
    aliases: ['h', 'commands'],
    async execute(message, args) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎰 Casino Bot Commands 🎰')
            .setDescription('Welcome to the casino! Here are all the available commands:')
            .addFields(
                { 
                    name: '💰 Economy Commands', 
                    value: '`$balance` - Check your balance\n`$daily` - Claim daily reward (2000 coins)\n`$transfer <user> <amount>` - Send money to another user\n`$leaderboard` - See the richest players\n`$stats [user]` - View gambling statistics', 
                    inline: false 
                },
                { 
                    name: '🎲 Casino Games', 
                    value: '`$blackjack <amount>` - Play blackjack (21)\n`$coinflip <heads/tails> <amount>` - Bet on a coin flip\n`$dice <amount>` - Roll a dice (win on 6, 5x payout)\n`$slots <amount>` - Play the slot machine\n`$roulette <bet_type> <amount>` - Play roulette', 
                    inline: false 
                },
                { 
                    name: '🎰 Growing Jackpot Lottery', 
                    value: '`$lotto <number>` - Play growing jackpot lottery! ($100, pick 1-100)\n• 🎊 **Growing Jackpot**: Starts at $10K, +$50 per ticket\n• 🔥 Close Win: $2,500 (±1 number)\n• ⚡ Near Miss: $500 (±2-3 numbers)\n• 🎁 Consolation: $150 (±4-10 numbers)\n`$lotto_pool` - View current jackpot & statistics', 
                    inline: false 
                },
                { 
                    name: '🎮 Interactive Games', 
                    value: '`$connect4 @user` - Challenge someone to Connect 4\n`$blackjack <amount>` - Interactive blackjack with buttons', 
                    inline: false 
                },
                { 
                    name: '🎯 Roulette Bet Types', 
                    value: '• `red/black` - Bet on color (2x payout)\n• `even/odd` - Bet on even or odd (2x payout)\n• `high/low` - Bet on 1-18 or 19-36 (2x payout)\n• `0-36` - Bet on specific number (35x payout)', 
                    inline: false 
                },
                { 
                    name: '🏦 Credit & Loans', 
                    value: '`$credit @user <amount>` - Request a loan (25% interest)\n`$repay @user` - Repay your loan with interest', 
                    inline: false 
                },
                { 
                    name: '🎰 Special Features', 
                    value: '`$jackpot status` - View jackpot information\n`$jackpot buy <amount>` - Buy pre-jackpot tickets', 
                    inline: false 
                }
            )
            .setFooter({ text: '🍀 Good luck and gamble responsibly! 🎊' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    },
}; 