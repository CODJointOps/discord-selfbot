const { sendCommandResponse } = require('../utils/messageUtils');

module.exports = {
  name: 'react',
  description: `Automatically react with specified emojis to multiple users' messages, or stop reacting.`,
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

    const targetIds = processUserInput(args[0]);
    const emojis = args.slice(1);

    if (targetIds.length === 0 || emojis.length === 0) {
      await sendCommandResponse(message, 'Please provide valid user IDs or @mentions and at least one emoji.', deleteTimeout, false);
      return;
    }

    message.client.targetReactUserIds = targetIds;
    message.client.reactEmojis = emojis;

    await sendCommandResponse(
      message,
      `I will now react to messages from the following users: ${targetIds
        .map(id => `User ID: ${id}`)
        .join(', ')} with the following emojis: ${emojis.join(' ')}.`,
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
          
          for (const emoji of emojis) {
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