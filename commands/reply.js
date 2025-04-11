const { sendCommandResponse } = require('../utils/messageUtils');

module.exports = {
    name: 'reply',
    description: `Automatically reply with a specified message to multiple users' messages, or stop replying. Usage: .reply [user1,user2,...] [message]`,
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
  
      // Find where the message starts (after all user IDs)
      let messageStartIndex = -1;
      for (let i = 0; i < args.length; i++) {
        // If this argument looks like a message (contains spaces or is longer than a user ID)
        if (args[i].includes(' ') || args[i].length > 20) {
          messageStartIndex = i;
          break;
        }
      }
      
      if (messageStartIndex === -1) {
        await sendCommandResponse(message, 'Please provide a message to reply with.', deleteTimeout, false);
        return;
      }
  
      // All arguments before messageStartIndex are user IDs
      const userInput = args.slice(0, messageStartIndex).join(' ');
      const replyMessage = args.slice(messageStartIndex).join(' ');
  
      console.log(`[REPLY] Processing user input: "${userInput}"`);
      const targetIds = processUserInput(userInput);
      console.log(`[REPLY] Extracted user IDs: ${targetIds.join(', ')}`);
      
      if (targetIds.length === 0) {
        await sendCommandResponse(message, 'Please provide valid user IDs or @mentions. You can use multiple users separated by spaces or commas.', deleteTimeout, false);
        return;
      }
  
      message.client.targetReplyUserIds = targetIds;
      message.client.replyMessage = replyMessage;
  
      // Create a more detailed confirmation message with a different format
      let userListText = '';
      if (targetIds.length === 1) {
        userListText = `User ID: ${targetIds[0]}`;
      } else {
        userListText = targetIds.map((id, index) => `User ID ${index + 1}: ${id}`).join('\n');
      }
      
      const confirmationMessage = `I will now reply to messages from:\n${userListText}\n\nWith the message: "${replyMessage}"`;
      
      console.log(`[REPLY] Confirmation message: ${confirmationMessage}`);
      
      await sendCommandResponse(
        message,
        confirmationMessage,
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
  