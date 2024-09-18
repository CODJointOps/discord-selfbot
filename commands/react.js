module.exports = {
  name: 'react',
  description: `Automatically react with specified emojis to multiple users’ messages, or stop reacting.\n
  Usage:
  .react <userID1,userID2,...> <emoji1> <emoji2> ... - React to messages from multiple users with specified emojis. 
  Example: \`.react 12345,67890 :smile: :thumbsup:\`
  .react stop - Stop reacting to users' messages.`,
  async execute(message, args, deleteTimeout) {
    if (args.length === 0) {
      if (message.client.targetReactUserIds && message.client.reactEmojis) {
        const statusMsg = await message.channel.send(
          `Currently reacting to messages from the following users: ${message.client.targetReactUserIds
            .map(id => `<@${id}>`)
            .join(', ')} with the following emojis: ${message.client.reactEmojis.join(' ')}.`
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
        message.client.targetReactUserIds = null;
        message.client.reactEmojis = null;

        const stopMsg = await message.channel.send('Stopped reacting to messages.');
        setTimeout(() => stopMsg.delete().catch(console.error), deleteTimeout);
      } else {
        const noActiveReactMsg = await message.channel.send('No active reactions to stop.');
        setTimeout(() => noActiveReactMsg.delete().catch(console.error), deleteTimeout);
      }
      return;
    }

    const targetIds = args[0].split(',').map(id => id.trim());
    const emojis = args.slice(1);

    if (targetIds.length === 0 || emojis.length === 0) {
      const errorMsg = await message.channel.send('Please provide valid user IDs and at least one emoji.');
      setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
      return;
    }

    message.client.targetReactUserIds = targetIds;
    message.client.reactEmojis = emojis;

    const confirmationMsg = await message.channel.send(
      `I will now react to messages from the following users: ${targetIds
        .map(id => `<@${id}>`)
        .join(', ')} with the following emojis: ${emojis.join(' ')}.`
    );
    setTimeout(() => confirmationMsg.delete().catch(console.error), deleteTimeout);

    if (message.client.reactListener) {
      message.client.off('messageCreate', message.client.reactListener);
    }

    const getRandomDelay = () => Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;

    message.client.reactListener = async (msg) => {
      if (message.client.targetReactUserIds && message.client.targetReactUserIds.includes(msg.author.id)) {
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