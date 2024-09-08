module.exports = {
  name: 'react',
  description: 'Automatically react with specified emojis to a user’s messages, or stop reacting.',
  async execute(message, args, deleteTimeout) {
    if (args.length === 0) {
      if (message.client.targetReactUserId && message.client.reactEmojis) {
        const statusMsg = await message.channel.send(
          `Currently reacting to <@${message.client.targetReactUserId}> with the following emojis: ${message.client.reactEmojis.join(' ')}.`
        );
        setTimeout(() => statusMsg.delete().catch(console.error), deleteTimeout);
      } else {
        const noTargetMsg = await message.channel.send('No active reaction target.');
        setTimeout(() => noTargetMsg.delete().catch(console.error), deleteTimeout);
      }
      return;
    }

    if (args[0].toLowerCase() === 'stop') {
      if (message.client.reactListener) {
        message.client.off('messageCreate', message.client.reactListener);
        message.client.reactListener = null;
        message.client.targetReactUserId = null;
        message.client.reactEmojis = null;

        const stopMsg = await message.channel.send('Stopped reacting to messages.');
        setTimeout(() => stopMsg.delete().catch(console.error), deleteTimeout);
      } else {
        const noActiveReactMsg = await message.channel.send('No active reactions to stop.');
        setTimeout(() => noActiveReactMsg.delete().catch(console.error), deleteTimeout);
      }
      return;
    }

    const targetId = args[0];
    const emojis = args.slice(1);

    if (!targetId || emojis.length === 0) {
      const errorMsg = await message.channel.send('Please provide a valid user ID and at least one emoji.');
      setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
      return;
    }

    message.client.targetReactUserId = targetId;
    message.client.reactEmojis = emojis;

    const confirmationMsg = await message.channel.send(
      `I will now react to messages from <@${targetId}> with the following emojis: ${emojis.join(' ')}.`
    );
    setTimeout(() => confirmationMsg.delete().catch(console.error), deleteTimeout);

    if (message.client.reactListener) {
      message.client.off('messageCreate', message.client.reactListener);
    }

    const getRandomDelay = () => Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;

    message.client.reactListener = async (msg) => {
      if (msg.author.id === targetId) {
        for (const emoji of emojis) {
          try {
            const delay = getRandomDelay();
            await new Promise((resolve) => setTimeout(resolve, delay));
            await msg.react(emoji);
          } catch (error) {
            console.error('Failed to react:', error);
          }
        }
      }
    };

    message.client.on('messageCreate', message.client.reactListener);
  },
};
