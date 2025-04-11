const { sendCommandResponse } = require('../utils/messageUtils');

module.exports = {
  name: 'react',
  description: `Automatically react with specified emojis to multiple users' messages, or stop reacting. Usage: .react [user1,user2,...] [emoji1] [emoji2] ...`,
  async execute(message, args, deleteTimeout) {
    const { processUserInput } = require('../utils/userUtils');
    
    if (args.length === 0) {
      if (message.client.targetReactUserIds && message.client.reactEmojis) {
        await sendCommandResponse(
          message,
          `Currently reacting to messages from the following users: ${message.client.targetReactUserIds
            .map(id => `User ID: ${id}`)
            .join(', ')} with the following emojis: ${message.client.reactEmojis.join(' ')}.`,
          deleteTimeout,
          false
        );
      } else {
        await sendCommandResponse(message, 'No active reaction target.', deleteTimeout, false);
      }
      return;
    }

    if (args[0].toLowerCase() === 'stop') {
      if (message.client.reactListener) {
        message.client.off('messageCreate', message.client.reactListener);
        message.client.reactListener = null;
        message.client.targetReactUserIds = null;
        message.client.reactEmojis = null;

        await sendCommandResponse(message, 'Stopped reacting to messages.', deleteTimeout, false);
      } else {
        await sendCommandResponse(message, 'No active reactions to stop.', deleteTimeout, false);
      }
      return;
    }

    // Find where the emojis start
    let emojiStartIndex = -1;
    for (let i = 0; i < args.length; i++) {
      // Check if this argument looks like an emoji (contains : or is a single character)
      if (args[i].includes(':') || args[i].length <= 2) {
        emojiStartIndex = i;
        break;
      }
    }

    if (emojiStartIndex === -1) {
      await sendCommandResponse(message, 'Please provide at least one emoji to react with.', deleteTimeout, false);
      return;
    }

    // All arguments before emojiStartIndex are user IDs
    const userInput = args.slice(0, emojiStartIndex).join(' ');
    const emojis = args.slice(emojiStartIndex);

    console.log(`[REACT] Processing user input: "${userInput}"`);
    const targetIds = processUserInput(userInput);
    console.log(`[REACT] Extracted user IDs: ${targetIds.join(', ')}`);
    
    if (targetIds.length === 0) {
      await sendCommandResponse(message, 'Please provide valid user IDs or @mentions. You can use multiple users separated by spaces or commas.', deleteTimeout, false);
      return;
    }

    // Process emojis to handle custom emojis
    const processedEmojis = emojis.map(emoji => {
      // Check if it's a custom emoji (format: :name:)
      const customEmojiMatch = emoji.match(/^:([a-zA-Z0-9_]+):$/);
      if (customEmojiMatch) {
        // For custom emojis, we need to find the emoji ID from the guild
        const emojiName = customEmojiMatch[1];
        const customEmoji = message.guild?.emojis.cache.find(e => e.name === emojiName);
        if (customEmoji) {
          return customEmoji.id;
        }
      }
      // For standard emojis, just return as is
      return emoji;
    });

    message.client.targetReactUserIds = targetIds;
    message.client.reactEmojis = processedEmojis;

    // Create a more detailed confirmation message with a different format
    let userListText = '';
    if (targetIds.length === 1) {
      userListText = `User ID: ${targetIds[0]}`;
    } else {
      userListText = targetIds.map((id, index) => `User ID ${index + 1}: ${id}`).join('\n');
    }
    
    const confirmationMessage = `I will now react to messages from:\n${userListText}\n\nWith the following emojis: ${emojis.join(' ')}`;
    
    console.log(`[REACT] Confirmation message: ${confirmationMessage}`);
    
    await sendCommandResponse(
      message,
      confirmationMessage,
      deleteTimeout,
      false
    );

    if (message.client.reactListener) {
      message.client.off('messageCreate', message.client.reactListener);
    }

    const getHumanizedDelay = () => {
      const baseDelay = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
      const jitter = Math.floor(Math.random() * 1000) - 500; 
      return Math.max(800, baseDelay + jitter);
    };

    message.client.reactListener = async (msg) => {
      if (message.client.targetReactUserIds && message.client.targetReactUserIds.includes(msg.author.id)) {
        try {
          const shouldReact = Math.random() < 0.95; 
          
          if (!shouldReact) {
            console.log(`[REACT] Randomly skipping reaction to message ${msg.id}`);
            return;
          }
          
          const initialDelay = getHumanizedDelay();
          await new Promise(resolve => setTimeout(resolve, initialDelay));
          
          for (const emoji of processedEmojis) {
            if (Math.random() < 0.05) {
              console.log(`[REACT] Skipping emoji ${emoji} for more human-like behavior`);
              continue;
            }
            
            try {
              const reactDelay = getHumanizedDelay();
              
              if (Math.random() < 0.08) {
                const extraDelay = Math.floor(Math.random() * 4000) + 1000;
                console.log(`[REACT] Adding ${extraDelay}ms extra delay before reacting with ${emoji}`);
                await new Promise(resolve => setTimeout(resolve, extraDelay));
              }
              
              await new Promise(resolve => setTimeout(resolve, reactDelay));
              await msg.react(emoji);
              
            } catch (error) {
              console.error(`[REACT] Failed to react with ${emoji}:`, error);
            }
          }
        } catch (error) {
          console.error('[REACT] Error in reaction handler:', error);
        }
      }
    };

    message.client.on('messageCreate', message.client.reactListener);
  },
};