module.exports = {
  name: 'help',
  description: 'List all of my commands or info about a specific command.',
  execute(message, args, deleteTimeout) {
    let reply = 'Here are my supported commands:\n\n';
    const commands = Array.from(message.client.commands.values());
    reply += commands.map(command => `.${command.name} - ${command.description}`).join('\n');

    message.channel.send(reply).then(sentMessage => {
      setTimeout(() => sentMessage.delete().catch(console.error), deleteTimeout);
    });
  },
};

