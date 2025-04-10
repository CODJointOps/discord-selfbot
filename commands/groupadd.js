let targetUserIds = new Set();
let isActive = false;
let channelToWatch = null;
let lastAddTimes = new Map();
let failedAttempts = new Map();
let recentAdds = new Map();
const { sendCommandResponse } = require('../utils/messageUtils');

const getBackoffDelay = (userId) => {
    const attempts = failedAttempts.get(userId) || 0;
    
    if (attempts <= 1) return 2000;
    if (attempts <= 3) return 4000;
    if (attempts <= 5) return 7000;
    if (attempts <= 10) return 15000;
    return 30000;
};

const getAddDelay = () => {
    const baseDelay = Math.floor(Math.random() * 700) + 800;
    const jitter = Math.floor(Math.random() * 300) - 150;
    return Math.max(500, baseDelay + jitter);
};

module.exports = {
    name: 'groupadd',
    description: 'Automatically re-adds users to group when they leave.',
    async execute(message, args, deleteTimeout) {
        const { extractUserId } = require('../utils/userUtils');
        
        if (message.channel.type !== 'GROUP_DM') {
            await sendCommandResponse(message, 'This command only works in group DMs.', deleteTimeout, true);
            return;
        }

        if (args[0]?.toLowerCase() === 'stop') {
            isActive = false;
            targetUserIds.clear();
            lastAddTimes.clear();
            failedAttempts.clear();
            recentAdds.clear();
            channelToWatch = null;
            console.log('[GROUPADD] System deactivated');

            await sendCommandResponse(message, 'Group auto-add deactivated.', deleteTimeout, true);
            return;
        }

        const validIds = args
            .map(arg => extractUserId(arg))
            .filter(id => id !== null);
            
        if (validIds.length === 0) {
            await sendCommandResponse(message, 'Please provide at least one valid user ID or @mention.', deleteTimeout, true);
            return;
        }

        channelToWatch = message.channel;
        targetUserIds = new Set(validIds);
        isActive = true;
        failedAttempts.clear();
        recentAdds.clear();

        console.log(`[GROUPADD] System activated - Targeting users: ${Array.from(targetUserIds).join(', ')}`);

        for (const userId of targetUserIds) {
            try {
                if (!channelToWatch.recipients.has(userId)) {
                    console.log(`[GROUPADD] Target ${userId} not in group, attempting initial add`);
                    
                    const initialDelay = Math.floor(Math.random() * 500) + 300;
                    await new Promise(resolve => setTimeout(resolve, initialDelay));
                    
                    await channelToWatch.addUser(userId);
                    lastAddTimes.set(userId, Date.now());
                    recentAdds.set(userId, true);
                    
                    setTimeout(() => {
                        recentAdds.delete(userId);
                    }, 10000);
                    
                    console.log(`[GROUPADD] Initial add successful for ${userId}`);
                }
            } catch (error) {
                console.log(`[GROUPADD] Initial add failed for ${userId}:`, error);
                failedAttempts.set(userId, (failedAttempts.get(userId) || 0) + 1);
            }
        }

        const handleRecipientRemove = async (channel, user) => {
            if (!isActive || channel.id !== channelToWatch.id || !targetUserIds.has(user.id)) return;

            const currentTime = Date.now();
            const lastAddTime = lastAddTimes.get(user.id) || 0;
            const timeSinceLastAdd = currentTime - lastAddTime;
            
            const isRecentlyAdded = recentAdds.has(user.id);
            const failCount = failedAttempts.get(user.id) || 0;

            console.log(`[GROUPADD] User ${user.id} left. Time since last add: ${timeSinceLastAdd}ms, Recent add: ${isRecentlyAdded}, Failed attempts: ${failCount}`);
            
            if (isRecentlyAdded) {
                console.log(`[GROUPADD] User ${user.id} was recently added and left immediately. Waiting longer.`);
                await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));
            }
            
            if (timeSinceLastAdd < 2000) {
                const backoffTime = getBackoffDelay(user.id);
                console.log(`[GROUPADD] Rate limiting for ${user.id}, waiting ${backoffTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            }

            const addDelay = getAddDelay();
            console.log(`[GROUPADD] Will readd user ${user.id} after ${addDelay}ms`);
            
            await new Promise(resolve => setTimeout(resolve, addDelay));
            
            if (!isActive) {
                console.log(`[GROUPADD] Command was deactivated during delay, cancelling re-add for ${user.id}`);
                return;
            }

            try {
                await channel.addUser(user.id);
                lastAddTimes.set(user.id, Date.now());
                recentAdds.set(user.id, true);
                
                setTimeout(() => {
                    recentAdds.delete(user.id);
                }, 10000);
                
                console.log(`[GROUPADD] Successfully re-added user ${user.id}`);
                
                if (failedAttempts.get(user.id) > 0) {
                    failedAttempts.set(user.id, Math.max(0, failedAttempts.get(user.id) - 1));
                }
            } catch (error) {
                console.log(`[GROUPADD] Failed to re-add user ${user.id}:`, error);
                failedAttempts.set(user.id, (failedAttempts.get(user.id) || 0) + 1);
                
                if (Math.random() < 0.4 && timeSinceLastAdd > 5000) {
                    console.log(`[GROUPADD] Will try again after a pause`);
                    setTimeout(() => {
                        if (isActive && !channel.recipients.has(user.id)) {
                            channel.addUser(user.id).catch(e => 
                                console.log(`[GROUPADD] Retry failed for ${user.id}:`, e)
                            );
                        }
                    }, 3000 + Math.random() * 2000);
                }
            }
        };

        message.client.on('channelRecipientRemove', handleRecipientRemove);

        const targetCount = targetUserIds.size;
        await sendCommandResponse(message, `Now watching for ${targetCount} user${targetCount > 1 ? 's' : ''} to leave the group.`, deleteTimeout, true);
    },
};