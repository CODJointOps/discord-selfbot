module.exports = {
  name: 'delete',
  description: 'Delete a specified number of your messages with human-like delays.',
  async execute(message, args, deleteTimeout) {
    const deleteCount = parseInt(args[0], 10);

    if (isNaN(deleteCount) || deleteCount <= 0) {
      const errorMsg = await message.channel.send('Please provide a valid number of messages to delete.');
      setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
      return;
    }

    const getRandomDelay = () => Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;

    const getBatchDelay = () => Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;

    const BATCH_SIZE = 10;

    try {
      let remainingMessages = deleteCount;

      while (remainingMessages > 0) {
        const fetchLimit = Math.min(remainingMessages, BATCH_SIZE);
        const messages = await message.channel.messages.fetch({ limit: fetchLimit + 1 });

        const filteredMessages = messages.filter(msg => msg.author.id === message.author.id);
        for (const msg of filteredMessages.values()) {
          try {
            if (msg.deletable) {
              const delay = getRandomDelay();
              await new Promise(resolve => setTimeout(resolve, delay));
              await msg.delete().catch(err => {
                if (err.code !== 10008) {
                  console.error('Failed to delete message:', err);
                }
              });
            }
          } catch (error) {
            console.error('Error deleting message:', error);
          }
        }

        remainingMessages -= filteredMessages.size;

        if (remainingMessages > 0) {
          const batchDelay = getBatchDelay();
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
    } catch (error) {
      console.error('Failed to delete messages:', error);
      const errorMsg = await message.channel.send('There was an error while trying to delete messages.');
      setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
    }
  },
};