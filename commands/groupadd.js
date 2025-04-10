let targetUserIds = new Set();
let isActive = false;
let channelToWatch = null;
let lastAddTimes = new Map();

const getRandomDelay = () => {
    return Math.floor(Math.random() * 200) + 150;
};

module.exports = {
    name: 'groupadd',
    description: 'Automatically re-adds users to group when they leave. Use multiple IDs for multiple targets.',
    async execute(message, args, deleteTimeout) {
        const { extractUserId } = require('../utils/userUtils');
        
        if (message.channel.type !== 'GROUP_DM') {
            message.channel.send('This command only works in group DMs.')
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            return;
        }

        if (args[0]?.toLowerCase() === 'stop') {
            isActive = false;
            targetUserIds.clear();
            lastAddTimes.clear();
            channelToWatch = null;
            console.log('[GROUPADD] System deactivated');

            message.channel.send('Group auto-add deactivated.')
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            return;
        }

        const validIds = args
            .map(arg => extractUserId(arg))
            .filter(id => id !== null);
            
        if (validIds.length === 0) {
            message.channel.send('Please provide at least one valid user ID or @mention.')
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            return;
        }

        channelToWatch = message.channel;
        targetUserIds = new Set(validIds);
        isActive = true;

        console.log(`[GROUPADD] System activated - Targeting users: ${Array.from(targetUserIds).join(', ')}`);

        for (const userId of targetUserIds) {
            try {
                if (!channelToWatch.recipients.has(userId)) {
                    console.log(`[GROUPADD] Target ${userId} not in group, attempting initial add`);
                    await channelToWatch.addUser(userId);
                    console.log(`[GROUPADD] Initial add successful for ${userId}`);
                }
            } catch (error) {
                console.log(`[GROUPADD] Initial add failed for ${userId}:`, error);
            }
        }

        message.client.on('channelRecipientRemove', async (channel, user) => {
            if (!isActive || channel.id !== channelToWatch.id || !targetUserIds.has(user.id)) return;

            const currentTime = Date.now();
            const lastAddTime = lastAddTimes.get(user.id) || 0;
            const timeSinceLastAdd = currentTime - lastAddTime;

            if (timeSinceLastAdd < 1000) {
                console.log(`[GROUPADD] Rate limiting for ${user.id}, waiting...`);
                await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastAdd));
            }

            const delay = getRandomDelay();
            console.log(`[GROUPADD] User ${user.id} left, waiting ${delay}ms before re-adding`);

            await new Promise(resolve => setTimeout(resolve, delay));

            try {
                await channel.addUser(user.id);
                lastAddTimes.set(user.id, Date.now());
                console.log(`[GROUPADD] Successfully re-added user ${user.id}`);
            } catch (error) {
                console.log(`[GROUPADD] Failed to re-add user ${user.id}:`, error);
            }
        });

        const targetCount = targetUserIds.size;
        message.channel.send(`Now watching for ${targetCount} user${targetCount > 1 ? 's' : ''} to leave the group.`)
            .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
    },
};