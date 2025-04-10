let isDeleting = false;
let cancelDelete = false;
let deletedMessages = new Set();
const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000;

// Cleanup deleted message cache periodically
setInterval(() => {
  if (deletedMessages.size > 1000) {
    console.log(`[DELETE] Cleaning message cache (size: ${deletedMessages.size})`);
    deletedMessages.clear();
  }
}, CACHE_CLEANUP_INTERVAL);

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

    // Check for speed settings
    let speed = 'medium';
    if (args[0] && ['slow', 'medium', 'fast'].includes(args[0].toLowerCase())) {
      speed = args[0].toLowerCase();
      args.shift(); // Remove the speed argument
    }

    const deleteCount = parseInt(args[0], 10);
    const targetGuildId = args[1];

    if (!isNaN(deleteCount) && deleteCount > 0) {
      await deleteMessagesFromChannel(message, deleteCount, deleteTimeout, speed);
    } else if (targetGuildId) {
      await deleteMessagesFromServer(message, targetGuildId, deleteTimeout, speed);
    } else {
      const errorMsg = await message.channel.send('Please specify how many messages to delete or a server ID. You can also set speed: `.delete [slow/medium/fast] [count/server]`');
      setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
    }

    isDeleting = false;
  },
};

async function deleteMessagesFromChannel(message, deleteCount, deleteTimeout, speed = 'medium') {
  // Human-like timing parameters based on speed setting
  let deleteIntervalMin, deleteIntervalMax, jitterFactor, pauseChance, pauseLengthMin, pauseLengthMax, batchSize;
  
  switch(speed) {
    case 'slow':
      deleteIntervalMin = 3000;
      deleteIntervalMax = 6000;
      jitterFactor = 0.5;
      pauseChance = 0.25;
      pauseLengthMin = 15000;
      pauseLengthMax = 45000;
      batchSize = 5;
      break;
    case 'fast':
      deleteIntervalMin = 1500;
      deleteIntervalMax = 3000;
      jitterFactor = 0.3;
      pauseChance = 0.05;
      pauseLengthMin = 5000;
      pauseLengthMax = 15000;
      batchSize = 15;
      break;
    case 'medium':
    default:
      deleteIntervalMin = 2000;
      deleteIntervalMax = 4500;
      jitterFactor = 0.4;
      pauseChance = 0.15;
      pauseLengthMin = 10000;
      pauseLengthMax = 30000;
      batchSize = 10;
  }
  
  // More human-like delay functions
  const getHumanlikeDelay = () => {
    const baseInterval = Math.floor(Math.random() * (deleteIntervalMax - deleteIntervalMin + 1)) + deleteIntervalMin;
    const jitterAmount = baseInterval * jitterFactor;
    const jitter = Math.random() * jitterAmount * 2 - jitterAmount;
    return Math.max(1000, Math.floor(baseInterval + jitter));
  };
  
  const getReadingDelay = () => Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds

  try {
    console.log(`[DELETE] Starting deletion of up to ${deleteCount} messages with ${speed} speed`);
    let deletedCount = 0;
    let batchCount = 0;
    
    while (deletedCount < deleteCount && !cancelDelete) {
      // Show progress occasionally
      if (deletedCount > 0 && deletedCount % 25 === 0) {
        console.log(`[DELETE] Progress: ${deletedCount}/${deleteCount} messages deleted`);
      }
      
      const fetchLimit = Math.min(deleteCount - deletedCount, batchSize);
      const messages = await message.channel.messages.fetch({ limit: 100 }); // Fetch more to ensure we find user messages
      
      const filteredMessages = messages.filter(msg => 
        msg.author.id === message.author.id && 
        !deletedMessages.has(msg.id)
      );
      
      if (filteredMessages.size === 0) {
        console.log(`[DELETE] No more messages found in this channel`);
        break;
      }
      
      // Process current batch
      batchCount++;
      let messagesInThisBatch = 0;
      
      for (const msg of filteredMessages.values()) {
        if (cancelDelete) {
          console.log(`[DELETE] Operation canceled by user`);
          return;
        }
        
        // Exit the loop if we've deleted enough messages
        if (deletedCount >= deleteCount) break;
        
        try {
          if (msg.deletable && !msg.deleted && !deletedMessages.has(msg.id)) {
            // Simulate reading the message occasionally (25% chance)
            if (Math.random() < 0.25) {
              const readingDelay = getReadingDelay();
              console.log(`[DELETE] Taking ${readingDelay}ms to "read" before deleting message ${msg.id}`);
              await new Promise(resolve => setTimeout(resolve, readingDelay));
            }
            
            // Variable pre-delete delay
            const preDeleteDelay = Math.floor(Math.random() * 1000) + 250;
            await new Promise(resolve => setTimeout(resolve, preDeleteDelay));
            
            // Attempt to delete
            await msg.delete().catch(err => {
              if (err.code === 10008) {
                console.log(`[DELETE] Message ${msg.id} already deleted`);
                deletedMessages.add(msg.id);
              } else if (err.code === 429) {
                console.log(`[DELETE] Rate limited. Taking a longer break...`);
                // Don't count this one, we'll try again later
                return;
              } else {
                console.error(`[DELETE] Failed to delete message:`, err);
              }
            });
            
            // Successfully deleted
            deletedMessages.add(msg.id);
            deletedCount++;
            messagesInThisBatch++;
            
            // Add human-like delay between deletions
            const delay = getHumanlikeDelay();
            console.log(`[DELETE] Waiting ${delay}ms before next deletion`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error('[DELETE] Error deleting message:', error);
        }
      }
      
      // Break if we couldn't delete any messages in this batch
      if (messagesInThisBatch === 0) {
        console.log(`[DELETE] No deletable messages found in batch`);
        break;
      }
      
      // Take a natural pause between batches (with higher chance after several batches)
      if (!cancelDelete && deletedCount < deleteCount) {
        // More likely to pause after several consecutive batches
        const adjustedPauseChance = pauseChance * (1 + (Math.min(batchCount, 5) / 10));
        
        if (Math.random() < adjustedPauseChance) {
          const pauseDuration = Math.floor(Math.random() * (pauseLengthMax - pauseLengthMin + 1)) + pauseLengthMin;
          console.log(`[DELETE] Taking a break for ${Math.round(pauseDuration/1000)} seconds. Progress: ${deletedCount}/${deleteCount}`);
          await new Promise(resolve => setTimeout(resolve, pauseDuration));
          batchCount = 0; // Reset batch count after a pause
        }
      }
    }
    
    // Final status message
    if (cancelDelete) {
      const canceledMsg = await message.channel.send(`Delete operation canceled after removing ${deletedCount} messages.`);
      setTimeout(() => canceledMsg.delete().catch(console.error), deleteTimeout);
    } else {
      const completedMsg = await message.channel.send(`Finished deleting ${deletedCount} messages.`);
      setTimeout(() => completedMsg.delete().catch(console.error), deleteTimeout);
    }
  } catch (error) {
    console.error('[DELETE] Failed to delete messages:', error);
    const errorMsg = await message.channel.send('There was an error while trying to delete messages.');
    setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
  }
}

async function deleteMessagesFromServer(message, guildId, deleteTimeout, speed = 'medium') {
  const guild = message.client.guilds.cache.get(guildId);

  if (!guild) {
    const errorMsg = await message.channel.send('I am not in the server with the specified ID.');
    setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
    return;
  }
  
  // Human-like timing parameters based on speed setting
  let deleteIntervalMin, deleteIntervalMax, jitterFactor, pauseChance, pauseLengthMin, pauseLengthMax, batchSize;
  
  switch(speed) {
    case 'slow':
      deleteIntervalMin = 3000;
      deleteIntervalMax = 6000;
      jitterFactor = 0.5;
      pauseChance = 0.4;  // Higher chance to pause between channels
      pauseLengthMin = 30000;
      pauseLengthMax = 90000;
      batchSize = 5;
      break;
    case 'fast':
      deleteIntervalMin = 1500;
      deleteIntervalMax = 3000;
      jitterFactor = 0.3;
      pauseChance = 0.2;
      pauseLengthMin = 15000;
      pauseLengthMax = 45000;
      batchSize = 15;
      break;
    case 'medium':
    default:
      deleteIntervalMin = 2000;
      deleteIntervalMax = 4500;
      jitterFactor = 0.4;
      pauseChance = 0.3;
      pauseLengthMin = 20000;
      pauseLengthMax = 60000;
      batchSize = 10;
  }
  
  // More human-like delay functions
  const getHumanlikeDelay = () => {
    const baseInterval = Math.floor(Math.random() * (deleteIntervalMax - deleteIntervalMin + 1)) + deleteIntervalMin;
    const jitterAmount = baseInterval * jitterFactor;
    const jitter = Math.random() * jitterAmount * 2 - jitterAmount;
    return Math.max(1000, Math.floor(baseInterval + jitter));
  };

  console.log(`[DELETE] Starting server-wide deletion in server: ${guild.name}`);
  let totalDeleted = 0;

  try {
    const channels = guild.channels.cache.filter(channel => channel.isText());
    let processedChannels = 0;
    
    for (const [channelId, channel] of channels) {
      if (cancelDelete) {
        console.log(`[DELETE] Operation canceled by user`);
        break;
      }
      
      processedChannels++;
      console.log(`[DELETE] Processing channel ${processedChannels}/${channels.size}: ${channel.name}`);
      
      let hasMoreMessages = true;
      let messagesDeletedInChannel = 0;
      let batchCount = 0;
      
      while (hasMoreMessages && !cancelDelete) {
        const messages = await channel.messages.fetch({ limit: 100 });

        if (messages.size === 0) {
          hasMoreMessages = false;
          continue;
        }

        const filteredMessages = messages.filter(msg => 
          msg.author.id === message.author.id && 
          !deletedMessages.has(msg.id)
        );
        
        if (filteredMessages.size === 0) {
          hasMoreMessages = false;
          continue;
        }

        // Process current batch
        batchCount++;
        let messagesInThisBatch = 0;
        
        for (const msg of filteredMessages.values()) {
          if (cancelDelete) return;
          
          try {
            if (msg.deletable && !msg.deleted && !deletedMessages.has(msg.id)) {
              // Variable pre-delete delay
              const preDeleteDelay = Math.floor(Math.random() * 1000) + 250;
              await new Promise(resolve => setTimeout(resolve, preDeleteDelay));
              
              // Attempt to delete
              await msg.delete().catch(err => {
                if (err.code === 10008) {
                  console.log(`[DELETE] Message ${msg.id} already deleted`);
                  deletedMessages.add(msg.id);
                } else if (err.code === 429) {
                  console.log(`[DELETE] Rate limited. Taking a longer break...`);
                  // Take an extra long break on rate limits
                  return new Promise(resolve => setTimeout(resolve, 30000 + Math.random() * 30000));
                } else {
                  console.error(`[DELETE] Failed to delete message:`, err);
                }
              });
              
              // Successfully deleted
              deletedMessages.add(msg.id);
              totalDeleted++;
              messagesDeletedInChannel++;
              messagesInThisBatch++;
              
              // Add human-like delay between deletions
              const delay = getHumanlikeDelay();
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          } catch (error) {
            console.error('[DELETE] Error deleting message:', error);
          }
          
          // Break batch processing after certain number of messages to avoid long loops
          if (messagesInThisBatch >= batchSize) break;
        }

        // If we deleted fewer messages than the batch size, assume we've reached the end
        if (messagesInThisBatch < batchSize) {
          hasMoreMessages = false;
        } else {
          // Take a natural pause between batches within a channel
          const shouldPause = Math.random() < pauseChance;
          if (shouldPause && !cancelDelete) {
            const pauseDuration = Math.floor(Math.random() * (pauseLengthMin - pauseLengthMin/2 + 1)) + pauseLengthMin/2;
            console.log(`[DELETE] Taking a short break for ${Math.round(pauseDuration/1000)} seconds in channel ${channel.name}. Deleted so far: ${messagesDeletedInChannel}`);
            await new Promise(resolve => setTimeout(resolve, pauseDuration));
          }
        }
      }
      
      console.log(`[DELETE] Completed channel ${channel.name}: ${messagesDeletedInChannel} messages deleted`);
      
      // Take a longer pause between channels
      if (!cancelDelete && processedChannels < channels.size) {
        const pauseDuration = Math.floor(Math.random() * (pauseLengthMax - pauseLengthMin + 1)) + pauseLengthMin;
        console.log(`[DELETE] Moving to next channel in ${Math.round(pauseDuration/1000)} seconds. Total deleted so far: ${totalDeleted}`);
        await new Promise(resolve => setTimeout(resolve, pauseDuration));
      }
    }
    
    // Final status message
    if (cancelDelete) {
      const canceledMsg = await message.channel.send(`Server cleanup canceled after removing ${totalDeleted} messages across ${processedChannels} channels.`);
      setTimeout(() => canceledMsg.delete().catch(console.error), deleteTimeout);
    } else {
      const completedMsg = await message.channel.send(`Finished cleaning up ${guild.name}: ${totalDeleted} messages deleted across ${processedChannels} channels.`);
      setTimeout(() => completedMsg.delete().catch(console.error), deleteTimeout);
    }
  } catch (error) {
    console.error('[DELETE] Failed to delete messages in the server:', error);
    const errorMsg = await message.channel.send('There was an error while trying to delete messages from the server.');
    setTimeout(() => errorMsg.delete().catch(console.error), deleteTimeout);
  }
}