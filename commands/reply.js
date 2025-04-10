const { sendCommandResponse } = require('../utils/messageUtils');

module.exports = {
    name: 'reply',
    description: `Automatically reply with a specified message to multiple users' messages, or stop replying.`,
    async execute(message, args, deleteTimeout) {
      const { processUserInput } = require('../utils/userUtils');
      
      if (args.length === 0) {
        if (message.client.targetReplyUserIds && message.client.replyMessage) {
          await sendCommandResponse(
            message,
            `Currently replying to messages from the following users: ${message.client.targetReplyUserIds
              .map(id => `User ID: ${id}`)
              .join(', ')} with the message: "${message.client.replyMessage}".`,
            deleteTimeout,
            false
          );
        } else {
          await sendCommandResponse(message, 'No active reply target.', deleteTimeout, false);
        }
        return;
      }
  
      if (args[0].toLowerCase() === 'stop') {
        if (message.client.replyListener) {
          message.client.off('messageCreate', message.client.replyListener);
          message.client.replyListener = null;
          message.client.targetReplyUserIds = null;
          message.client.replyMessage = null;
  
          await sendCommandResponse(message, 'Stopped replying to messages.', deleteTimeout, false);
        } else {
          await sendCommandResponse(message, 'No active replies to stop.', deleteTimeout, false);
        }
        return;
      }
  
      const targetIds = processUserInput(args[0]);
      const replyMessage = args.slice(1).join(' ');
  
      if (targetIds.length === 0 || !replyMessage) {
        await sendCommandResponse(message, 'Please provide valid user IDs or @mentions and a message to reply with.', deleteTimeout, false);
        return;
      }
  
      message.client.targetReplyUserIds = targetIds;
      message.client.replyMessage = replyMessage;
  
      await sendCommandResponse(
        message,
        `I will now reply to messages from the following users: ${targetIds
          .map(id => `User ID: ${id}`)
          .join(', ')} with the message: "${replyMessage}".`,
        deleteTimeout,
        false
      );
  
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
  