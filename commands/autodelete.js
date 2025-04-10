let isAutoDeleteActive = false;
let deleteQueue = [];
let isProcessingQueue = false;
let messageTimers = new Map();
let ignoredMessages = new Set();
let isFirstDeletion = true;
let deletedMessages = new Set();
const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000;

const DELETION_DELAY = 5 * 60 * 1000;
let DELETE_INTERVAL_MIN = 8000;
let DELETE_INTERVAL_MAX = 15000;
let JITTER_FACTOR = 0.4;
let PAUSE_CHANCE = 0.15;
let PAUSE_LENGTH_MIN = 30000;
let PAUSE_LENGTH_MAX = 120000;
let BATCH_SIZE = 3;
let currentBatchCount = 0;

setInterval(() => {
    if (deletedMessages.size > 1000) {
        console.log(`[AUTODELETE] Cleaning message cache (size: ${deletedMessages.size})`);
        deletedMessages.clear();
    }
}, CACHE_CLEANUP_INTERVAL);

const getHumanlikeDelay = () => {
    const baseInterval = Math.floor(Math.random() * (DELETE_INTERVAL_MAX - DELETE_INTERVAL_MIN + 1)) + DELETE_INTERVAL_MIN;

    const jitterAmount = baseInterval * JITTER_FACTOR;
    const jitter = Math.random() * jitterAmount * 2 - jitterAmount;

    return Math.max(1000, Math.floor(baseInterval + jitter));
};

const shouldTakePause = () => {
    currentBatchCount++;

    if (currentBatchCount >= BATCH_SIZE) {
        currentBatchCount = 0;
        return Math.random() < PAUSE_CHANCE;
    }

    return false;
};

const getPauseDuration = () => {
    return Math.floor(Math.random() * (PAUSE_LENGTH_MAX - PAUSE_LENGTH_MIN + 1)) + PAUSE_LENGTH_MIN;
};

const processDeleteQueue = async () => {
    if (!isProcessingQueue || deleteQueue.length === 0) return;

    try {
        const messageToDelete = deleteQueue.shift();
        if (!messageToDelete) return;

        if (deletedMessages.has(messageToDelete.id)) {
            console.log(`[AUTODELETE] Message ${messageToDelete.id} already deleted (cached), skipping`);

            if (deleteQueue.length > 0 && isProcessingQueue) {
                scheduleNextDeletion();
            } else {
                isProcessingQueue = false;
            }
            return;
        }

        const preDeleteDelay = Math.floor(Math.random() * 1500) + 500; // 500-2000ms
        await new Promise(resolve => setTimeout(resolve, preDeleteDelay));

        if (isFirstDeletion || Math.random() < 0.35) {
            console.log(`[AUTODELETE] Checking message ${messageToDelete.id} existence${isFirstDeletion ? ' (first deletion)' : ''}`);
            const exists = await messageToDelete.fetch().catch(() => null);
            if (!exists) {
                console.log(`[AUTODELETE] Message ${messageToDelete.id} no longer exists, adding to cache`);
                deletedMessages.add(messageToDelete.id);
                isFirstDeletion = false;

                if (deleteQueue.length > 0 && isProcessingQueue) {
                    scheduleNextDeletion();
                } else {
                    isProcessingQueue = false;
                }
                return;
            }
        }

        if (Math.random() < 0.25) {
            const readingDelay = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds "reading" delay
            console.log(`[AUTODELETE] Taking ${readingDelay}ms to "read" before deleting`);
            await new Promise(resolve => setTimeout(resolve, readingDelay));
        }

        await messageToDelete.delete().catch((error) => {
            if (error.code === 10008) {
                console.log(`[AUTODELETE] Message ${messageToDelete.id} already deleted, adding to cache`);
                deletedMessages.add(messageToDelete.id);
            } else if (error.code === 429) {
                console.log(`[AUTODELETE] Rate limited when deleting ${messageToDelete.id}. Will retry later.`);

                deleteQueue.push(messageToDelete);

                DELETE_INTERVAL_MIN = Math.min(DELETE_INTERVAL_MIN * 1.5, 25000);
                DELETE_INTERVAL_MAX = Math.min(DELETE_INTERVAL_MAX * 1.5, 45000);
                console.log(`[AUTODELETE] Increased deletion intervals to ${DELETE_INTERVAL_MIN}-${DELETE_INTERVAL_MAX}ms`);
            } else {
                console.log(`[AUTODELETE] Couldn't delete message ${messageToDelete.id}:`, error);
            }
        });

        if (!deletedMessages.has(messageToDelete.id)) {
            deletedMessages.add(messageToDelete.id);
            console.log(`[AUTODELETE] Successfully deleted message ${messageToDelete.id}`);

            if (Math.random() < 0.1) {
                DELETE_INTERVAL_MIN = Math.max(DELETE_INTERVAL_MIN * 0.95, 8000);
                DELETE_INTERVAL_MAX = Math.max(DELETE_INTERVAL_MAX * 0.95, 15000);
            }
        }

        isFirstDeletion = false;

    } catch (error) {
        console.log('[AUTODELETE] Error processing queue:', error);
    }

    if (deleteQueue.length > 0 && isProcessingQueue) {
        scheduleNextDeletion();
    } else {
        isProcessingQueue = false;
    }
};

const scheduleNextDeletion = () => {
    if (shouldTakePause()) {
        const pauseDuration = getPauseDuration();
        console.log(`[AUTODELETE] Taking a break for ${Math.round(pauseDuration / 1000)} seconds before continuing deletion. Queue size: ${deleteQueue.length}`);
        setTimeout(processDeleteQueue, pauseDuration);
    } else {
        let nextInterval = getHumanlikeDelay();

        if (deleteQueue.length > 15) {
            nextInterval = Math.max(Math.floor(nextInterval * 0.8), 5000);
        }
        else if (deleteQueue.length <= 2) {
            nextInterval = Math.floor(nextInterval * 1.2);
        }

        console.log(`[AUTODELETE] Next deletion in ${nextInterval}ms | Queue size: ${deleteQueue.length}`);
        setTimeout(processDeleteQueue, nextInterval);
    }
};

const startQueueProcessing = () => {
    if (!isProcessingQueue && deleteQueue.length > 0) {
        isProcessingQueue = true;
        currentBatchCount = 0;
        processDeleteQueue();
    }
};

const handleNewMessage = (message) => {
    if (!isAutoDeleteActive || message.author.id !== message.client.user.id) return;

    if (ignoredMessages.has(message.id) || deletedMessages.has(message.id)) {
        console.log(`[AUTODELETE] Skipping cached/ignored message: ${message.id}`);
        return;
    }
    if (message.content.startsWith('.autodelete')) {
        console.log(`[AUTODELETE] Skipping command message: ${message.id}`);
        ignoredMessages.add(message.id);
        return;
    }

    console.log(`[AUTODELETE] New message tracked: ${message.id}`);
    console.log(`[AUTODELETE] Content preview: ${message.content.slice(0, 30)}...`);

    const variableDelay = DELETION_DELAY + (Math.random() * 60000) - 30000; // +/- 30 seconds

    const timer = setTimeout(() => {
        if (isAutoDeleteActive) {
            console.log(`[AUTODELETE] Timer completed for message: ${message.id} after ~${Math.round(variableDelay / 1000 / 60)} minutes`);
            if (!deletedMessages.has(message.id)) {
                deleteQueue.push(message);
                messageTimers.delete(message.id);
                startQueueProcessing();
            }
        }
    }, variableDelay);

    messageTimers.set(message.id, timer);
};

module.exports = {
    name: 'autodelete',
    description: 'Automatically deletes your messages after a set time',
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

            DELETE_INTERVAL_MIN = 8000;
            DELETE_INTERVAL_MAX = 15000;
            currentBatchCount = 0;

            console.log('[AUTODELETE] System deactivated - All timers cleared');
            message.channel.send('Auto-delete has been deactivated.')
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            return;
        }

        if (args[0]?.toLowerCase() === 'delay' && args[1]) {
            const newDelay = parseInt(args[1], 10);
            if (!isNaN(newDelay) && newDelay >= 1) {
                const oldDelay = Math.round(DELETION_DELAY / 1000 / 60);
                DELETION_DELAY = newDelay * 1000 * 60;
                message.channel.send(`Auto-delete delay changed from ${oldDelay} to ${newDelay} minutes.`)
                    .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                return;
            } else {
                message.channel.send('Please provide a valid delay in minutes (minimum 1 minute).')
                    .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                return;
            }
        }

        if (args[0]?.toLowerCase() === 'speed') {
            if (args[1]?.toLowerCase() === 'slow') {
                DELETE_INTERVAL_MIN = 15000;
                DELETE_INTERVAL_MAX = 30000;
                PAUSE_CHANCE = 0.25;
                message.channel.send('Auto-delete speed set to slow mode (very human-like with frequent pauses).')
                    .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                return;
            } else if (args[1]?.toLowerCase() === 'medium') {
                DELETE_INTERVAL_MIN = 8000;
                DELETE_INTERVAL_MAX = 15000;
                PAUSE_CHANCE = 0.15;
                message.channel.send('Auto-delete speed set to medium mode (balanced human-like behavior).')
                    .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                return;
            } else if (args[1]?.toLowerCase() === 'fast') {
                DELETE_INTERVAL_MIN = 5000;
                DELETE_INTERVAL_MAX = 10000;
                PAUSE_CHANCE = 0.05;
                message.channel.send('Auto-delete speed set to fast mode (less human-like but quicker progress).')
                    .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                return;
            } else {
                message.channel.send('Please specify a valid speed: slow, medium, or fast.')
                    .then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                return;
            }
        }

        if (!isAutoDeleteActive) {
            isAutoDeleteActive = true;
            isFirstDeletion = true;
            currentBatchCount = 0;
            console.log('[AUTODELETE] System activated - Now tracking new messages');

            message.client.removeListener('messageCreate', handleNewMessage);
            message.client.on('messageCreate', handleNewMessage);

            const delayInMinutes = Math.round(DELETION_DELAY / 1000 / 60);
            message.channel.send(
                `Auto-delete activated. Messages will be deleted after ~${delayInMinutes} minutes ` +
                `with human-like timing. Use \`.autodelete speed slow/medium/fast\` to adjust deletion speed.`
            ).then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
        } else {
            const delayInMinutes = Math.round(DELETION_DELAY / 1000 / 60);
            message.channel.send(
                `Auto-delete is already active. Current delay: ~${delayInMinutes} minutes. ` +
                `Use \`.autodelete speed slow/medium/fast\` to adjust deletion speed.`
            ).then(msg => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
        }
    },
};