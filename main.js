require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  if (message.author.id !== client.user.id) return;

  if (message.content.startsWith('.delete')) {
    const args = message.content.split(' ').slice(1);
    const deleteCount = parseInt(args[0], 10);

    if (!isNaN(deleteCount)) {
      const messages = await message.channel.messages.fetch({ limit: deleteCount + 1 });
      const filtered = messages.filter(msg => msg.author.id === client.user.id);
      filtered.forEach(msg => msg.delete().catch(console.error));
    }
  } else if (message.content === '.help') {
    message.channel.send('`.delete [number]` - Deletes a specified number of your messages.\n`.help` - Shows this help message.');
  }
});

client.login(process.env.DISCORD_TOKEN);

