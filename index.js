require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client();
const fs = require('fs');

const PREFIX = process.env.PREFIX || '.';
const MESSAGE_DELETE_TIMEOUT = 10000

client.commands = new Map();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  if (message.author.id !== client.user.id || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(1).split(/ +/);
  const commandName = args.shift().toLowerCase();

  if (!client.commands.has(commandName)) return;

  const deleteDelay = 2000;

  setTimeout(() => {
    message.delete().catch(console.error);
  }, deleteDelay);

  try {
    await client.commands.get(commandName).execute(message, args, MESSAGE_DELETE_TIMEOUT);
  } catch (error) {
    console.error(error);
    message.channel.send('There was an error trying to execute that command!')
      .then(sentMessage => {
        setTimeout(() => sentMessage.delete().catch(console.error), MESSAGE_DELETE_TIMEOUT);
      });
  }
});

client.login(process.env.DISCORD_TOKEN);
