const { sendCommandResponse } = require('../utils/messageUtils');

module.exports = {
  name: 'help',
  description: 'List all of my commands or info about a specific command.',
  async execute(message, args, deleteTimeout) {
    let reply = '```';
    reply += 'Here are the available commands:\n\n';

    const commands = Array.from(message.client.commands.values());
    commands.forEach(command => {
      reply += `.${command.name} - ${command.description}\n`;
    });

    reply += '```';

    await sendCommandResponse(message, reply, deleteTimeout, false);
  },
};

