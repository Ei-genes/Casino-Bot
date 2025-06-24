module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        // Set bot status to show help command
        client.user.setActivity('$help', { type: 'PLAYING' });
    },
}; 