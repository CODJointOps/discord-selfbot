module.exports = {
  name: 'delete',
  description: 'Delete a specified number of your messages.',
  async execute(message, args, deleteTimeout) {
    const deleteCount = parseInt(args[0], 10);

    if (isNaN(deleteCount)) {
      const errorMsg = await message.channel.send('Please provide the number of messages to delete.');
      setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
      return;
    }

    const messages = await message.channel.messages.fetch({ limit: deleteCount + 1 });
    const filtered = messages.filter(msg => msg.author.id === message.author.id);
    filtered.forEach(msg => {
      msg.delete().catch(console.error);
    });
  },
};
