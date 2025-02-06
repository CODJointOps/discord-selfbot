let isAutoDeleteActive = false;
let deleteQueue = [];
let isProcessingQueue = false;
let messageTimers = new Map();
let ignoredMessages = new Set();
let isFirstDeletion = true;

const DELETION_DELAY = 5 * 60 * 1000;
const MIN_DELETE_INTERVAL = 2500;
const MAX_DELETE_INTERVAL = 3500;

const getRandomInterval = () => {
    return Math.floor(Math.random() * (MAX_DELETE_INTERVAL - MIN_DELETE_INTERVAL)) + MIN_DELETE_INTERVAL;
};

const processDeleteQueue = async () => {
    if (!isProcessingQueue || deleteQueue.length === 0) return;

    try {
        const messageToDelete = deleteQueue.shift();
        if (!messageToDelete) return;

        const deleteDelay = Math.floor(Math.random() * 100) + 50;
        await new Promise(resolve => setTimeout(resolve, deleteDelay));
        console.log(`[AUTODELETE] Waited ${deleteDelay}ms before processing`);

        if (isFirstDeletion || Math.random() < 0.2) {
            console.log(`[AUTODELETE] Checking message ${messageToDelete.id} existence${isFirstDeletion ? ' (first deletion)' : ''}`);
            const exists = await messageToDelete.fetch().catch(() => null);
            if (!exists) {
                console.log(`[AUTODELETE] Message ${messageToDelete.id} no longer exists, skipping`);
                isFirstDeletion = false;
                if (deleteQueue.length > 0 && isProcessingQueue) {
                    const nextInterval = getRandomInterval();
                    console.log(`[AUTODELETE] Next deletion in ${nextInterval}ms | Queue size: ${deleteQueue.length}`);
                    setTimeout(processDeleteQueue, nextInterval);
                } else {
                    isProcessingQueue = false;
                }
                return;
            }
        }

        await messageToDelete.delete().catch(() => {
            console.log(`[AUTODELETE] Couldn't delete message ${messageToDelete.id}`);
        });

        console.log(`[AUTODELETE] Processed message ${messageToDelete.id}`);
        isFirstDeletion = false;

    } catch (error) {
        console.log('[AUTODELETE] Error processing queue:', error);
    }

    if (deleteQueue.length > 0 && isProcessingQueue) {
        const nextInterval = getRandomInterval();
        console.log(`[AUTODELETE] Next deletion in ${nextInterval}ms | Queue size: ${deleteQueue.length}`);
        setTimeout(processDeleteQueue, nextInterval);
    } else {
        isProcessingQueue = false;
    }
};

const startQueueProcessing = () => {
    if (!isProcessingQueue && deleteQueue.length > 0) {
        isProcessingQueue = true;
        processDeleteQueue();
    }
};

const handleNewMessage = (message) => {
    if (!isAutoDeleteActive || message.author.id !== message.client.user.id) return;

    if (ignoredMessages.has(message.id)) {
        console.log(`[AUTODELETE] Skipping ignored message: ${message.id}`);
        return;
    }
    if (message.content.startsWith('.autodelete')) {
        console.log(`[AUTODELETE] Skipping command message: ${message.id}`);
        return;
    }

    console.log(`[AUTODELETE] New message tracked: ${message.id}`);
    console.log(`[AUTODELETE] Content preview: ${message.content.slice(0, 30)}...`);

    const timer = setTimeout(() => {
        if (isAutoDeleteActive) {
            console.log(`[AUTODELETE] Timer completed for message: ${message.id}`);
            deleteQueue.push(message);
            messageTimers.delete(message.id);
            startQueueProcessing();
        }
    }, DELETION_DELAY);

    messageTimers.set(message.id, timer);
};

module.exports = {
    name: 'autodelete',
    description: 'Automatically deletes your messages after 5 minutes',
    async execute(message, args, deleteTimeout) {
        ignoredMessages.add(message.id);

        if (args[0]?.toLowerCase() === 'stop') {
            isAutoDeleteActive = false;

            for (const [messageId, timer] of messageTimers) {
                clearTimeout(timer);
                console.log(`[AUTODELETE] Cleared timer for message: ${messageId}`);
            }

            messageTimers.clear();
            deleteQueue = [];
            isProcessingQueue = false;
            isFirstDeletion = true;

            console.log('[AUTODELETE] System deactivated - All timers cleared');
            message.channel.send('Auto-delete has been deactivated.')
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            return;
        }

        if (!isAutoDeleteActive) {
            isAutoDeleteActive = true;
            isFirstDeletion = true;
            console.log('[AUTODELETE] System activated - Now tracking new messages');

            message.client.removeListener('messageCreate', handleNewMessage);
            message.client.on('messageCreate', handleNewMessage);

            message.channel.send('Auto-delete activated. Each message will be deleted after exactly 5 minutes.')
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
        } else {
            message.channel.send('Auto-delete is already active.')
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
        }
    },
};