let isDeleting = false;
let cancelDelete = false;

module.exports = {
  name: 'delete',
  description: 'Delete a specified number of your messages or all messages from a server with human-like delays.',
  async execute(message, args, deleteTimeout) {
    if (args[0] && args[0].toLowerCase() === 'cancel') {
      cancelDelete = true;
      const cancelMsg = await message.channel.send('Delete operation canceled.');
      setTimeout(() => cancelMsg.delete().catch(console.error), deleteTimeout);
      return;
    }

    if (isDeleting) {
      const inProgressMsg = await message.channel.send('A delete operation is already in progress. Please wait or cancel it with `.delete cancel`.');
      setTimeout(() => inProgressMsg.delete().catch(console.error), deleteTimeout);
      return;
    }

    isDeleting = true;
    cancelDelete = false;

    const deleteCount = parseInt(args[0], 10);
    const targetGuildId = args[1];

    if (!isNaN(deleteCount) && deleteCount > 0) {
      await deleteMessagesFromChannel(message, deleteCount, deleteTimeout);
    } else if (targetGuildId) {
      await deleteMessagesFromServer(message, targetGuildId, deleteTimeout);
    } else {
      const errorMsg = await message.channel.send('Please provide a valid number of messages or server ID.');
      setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
    }

    isDeleting = false;
  },
};

async function deleteMessagesFromChannel(message, deleteCount, deleteTimeout) {
  const getRandomDelay = () => Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
  const getBatchDelay = () => Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
  const BATCH_SIZE = 10;

  try {
    let remainingMessages = deleteCount;

    while (remainingMessages > 0 && !cancelDelete) {
      const fetchLimit = Math.min(remainingMessages, BATCH_SIZE);
      const messages = await message.channel.messages.fetch({ limit: fetchLimit + 1 });

      const filteredMessages = messages.filter(msg => msg.author.id === message.author.id);
      for (const msg of filteredMessages.values()) {
        if (cancelDelete) return;
        try {
          if (msg.deletable && !msg.deleted) {
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

      if (remainingMessages > 0 && !cancelDelete) {
        const batchDelay = getBatchDelay();
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
  } catch (error) {
    console.error('Failed to delete messages:', error);
    const errorMsg = await message.channel.send('There was an error while trying to delete messages.');
    setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
  }
}

async function deleteMessagesFromServer(message, guildId, deleteTimeout) {
  const guild = message.client.guilds.cache.get(guildId);

  if (!guild) {
    const errorMsg = await message.channel.send('I am not in the server with the specified ID.');
    setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
    return;
  }

  const getRandomDelay = () => Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
  const getBatchDelay = () => Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
  const BATCH_SIZE = 10;

  try {
    const channels = guild.channels.cache.filter(channel => channel.isText());
    for (const [channelId, channel] of channels) {
      if (cancelDelete) return;
      let hasMoreMessages = true;
      while (hasMoreMessages && !cancelDelete) {
        const messages = await channel.messages.fetch({ limit: BATCH_SIZE });

        if (messages.size === 0) {
          hasMoreMessages = false;
          continue;
        }

        const filteredMessages = messages.filter(msg => msg.author.id === message.author.id);
        for (const msg of filteredMessages.values()) {
          if (cancelDelete) return;
          try {
            if (msg.deletable && !msg.deleted) {
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

        if (filteredMessages.size < BATCH_SIZE) {
          hasMoreMessages = false;
        } else {
          const batchDelay = getBatchDelay();
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
    }
  } catch (error) {
    console.error('Failed to delete messages in the server:', error);
    const errorMsg = await message.channel.send('There was an error while trying to delete messages from the server.');
    setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
  }
}
