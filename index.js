require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client();
const fs = require('fs');
const readline = require('readline');

const PREFIX = process.env.PREFIX || '.';
const MESSAGE_DELETE_TIMEOUT = 10000

client.commands = new Map();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}! (DZ Loves you 2k25).`);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `Console > `
  });
  
  console.log('Type commands without the prefix to execute them in console mode.');
  console.log('--------------------------------------------------------');
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    const args = input.split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!client.commands.has(commandName)) {
      console.log(`Command not found: ${commandName}`);
      rl.prompt();
      return;
    }

    try {
      const mockMessage = {
        author: { id: client.user.id },
        client: client,
        channel: {
          id: 'console',
          send: (content) => {
            console.log('\nCommand output:');
            console.log(content);
            return Promise.resolve({ delete: () => Promise.resolve() });
          }
        },
        delete: () => Promise.resolve()
      };

      console.log(`Executing command: ${commandName}`);
      await client.commands.get(commandName).execute(mockMessage, args, MESSAGE_DELETE_TIMEOUT);
    } catch (error) {
      console.error('Error executing command:', error);
    }
    
    rl.prompt();
  });
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