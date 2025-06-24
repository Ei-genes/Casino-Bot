const { readDb, writeDb } = require('../data/database');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        } else if (interaction.isButton()) {
            // Handle button interactions for help, leaderboard, etc.
            const [action] = interaction.customId.split('_');
            
            // Most button interactions are handled within their respective commands
            // This is just a fallback for any unhandled interactions
            try {
                // Let the command handle its own button interactions
                return;
            } catch (error) {
                console.error('Button interaction error:', error);
            }
        }
    },
}; 