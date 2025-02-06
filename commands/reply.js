module.exports = {
    name: 'reply',
    description: `Automatically reply with a specified message to multiple users’ messages, or stop replying.`,
    async execute(message, args, deleteTimeout) {
      if (args.length === 0) {
        if (message.client.targetReplyUserIds && message.client.replyMessage) {
          const statusMsg = await message.channel.send(
            `Currently replying to messages from the following users: ${message.client.targetReplyUserIds
              .map(id => `<@${id}>`)
              .join(', ')} with the message: "${message.client.replyMessage}".`
          );
          setTimeout(() => statusMsg.delete().catch(console.error), deleteTimeout);
        } else {
          const noTargetMsg = await message.channel.send('No active reply target.');
          setTimeout(() => noTargetMsg.delete().catch(console.error), deleteTimeout);
        }
        return;
      }
  
      if (args[0].toLowerCase() === 'stop') {
        if (message.client.replyListener) {
          message.client.off('messageCreate', message.client.replyListener);
          message.client.replyListener = null;
          message.client.targetReplyUserIds = null;
          message.client.replyMessage = null;
  
          const stopMsg = await message.channel.send('Stopped replying to messages.');
          setTimeout(() => stopMsg.delete().catch(console.error), deleteTimeout);
        } else {
          const noActiveReplyMsg = await message.channel.send('No active replies to stop.');
          setTimeout(() => noActiveReplyMsg.delete().catch(console.error), deleteTimeout);
        }
        return;
      }
  
      const targetIds = args[0].split(',').map(id => id.trim());
      const replyMessage = args.slice(1).join(' ');
  
      if (targetIds.length === 0 || !replyMessage) {
        const errorMsg = await message.channel.send('Please provide valid user IDs and a message to reply with.');
        setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
        return;
      }
  
      message.client.targetReplyUserIds = targetIds;
      message.client.replyMessage = replyMessage;
  
      const confirmationMsg = await message.channel.send(
        `I will now reply to messages from the following users: ${targetIds
          .map(id => `<@${id}>`)
          .join(', ')} with the message: "${replyMessage}".`
      );
      setTimeout(() => confirmationMsg.delete().catch(console.error), deleteTimeout);
  
      if (message.client.replyListener) {
        message.client.off('messageCreate', message.client.replyListener);
      }
  
      const getRandomDelay = () => Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
  
      message.client.replyListener = async (msg) => {
        if (!message.client.targetReplyUserIds || !message.client.replyMessage) return;
  
        if (message.client.targetReplyUserIds.includes(msg.author.id)) {
          try {
            const delay = getRandomDelay();
            await new Promise((resolve) => setTimeout(resolve, delay));
            await msg.reply(message.client.replyMessage);
          } catch (error) {
            console.error('Failed to reply:', error);
          }
        }
      };
  
      message.client.on('messageCreate', message.client.replyListener);
    },
  };
  