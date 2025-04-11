let isAutoDeleteActive = false;
let deleteQueue = [];
let isProcessingQueue = false;
let messageTimers = new Map();
let ignoredMessages = new Set();
let isFirstDeletion = true;
let deletedMessages = new Set();
const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000;
const { sendCommandResponse } = require('../utils/messageUtils');

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
    
    if (message.content.includes('```') && message.content.length > 100) {
        console.log(`[AUTODELETE] Skipping command response message: ${message.id}`);
        ignoredMessages.add(message.id);
        return;
    }
    
    if (message.scheduledForDeletion) {
        console.log(`[AUTODELETE] Skipping message already scheduled for deletion: ${message.id}`);
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

        if (args.length === 0 || args[0].toLowerCase() === 'status') {
            const statusText = isAutoDeleteActive
                ? `Auto-delete is ON - Messages will be deleted after approximately ${Math.round(DELETION_DELAY / 1000 / 60)} minutes.`
                : 'Auto-delete is OFF.';

            await sendCommandResponse(
                message,
                `${statusText}\nQueue size: ${deleteQueue.length} messages | Tracked messages: ${messageTimers.size}`,
                deleteTimeout, 
                true
            );
            return;
        }

        const command = args[0].toLowerCase();

        if (command === 'on' || command === 'start' || command === 'enable') {
            if (isAutoDeleteActive) {
                await sendCommandResponse(message, 'Auto-delete is already active.', deleteTimeout, true);
                return;
            }

            isAutoDeleteActive = true;
            message.client.on('messageCreate', handleNewMessage);

            await sendCommandResponse(
                message,
                `Auto-delete enabled. Your messages will be deleted after approximately ${Math.round(DELETION_DELAY / 1000 / 60)} minutes.`,
                deleteTimeout,
                true
            );
            return;
        }

        if (command === 'off' || command === 'stop' || command === 'disable') {
            if (!isAutoDeleteActive) {
                await sendCommandResponse(message, 'Auto-delete is not active.', deleteTimeout, true);
                return;
            }

            isAutoDeleteActive = false;
            message.client.off('messageCreate', handleNewMessage);

            for (const timer of messageTimers.values()) {
                clearTimeout(timer);
            }
            messageTimers.clear();

            await sendCommandResponse(message, 'Auto-delete disabled. Messages will no longer be automatically deleted.', deleteTimeout, true);
            return;
        }

        if (command === 'clear') {
            const queueSize = deleteQueue.length;
            const trackCount = messageTimers.size;
            
            deleteQueue = [];
            for (const timer of messageTimers.values()) {
                clearTimeout(timer);
            }
            messageTimers.clear();
            currentBatchCount = 0;
            
            await sendCommandResponse(message, `Cleared auto-delete queue (${queueSize} pending, ${trackCount} tracked).`, deleteTimeout, true);
            return;
        }

        if (command === 'speed') {
            const speedOption = args[1]?.toLowerCase();
            
            if (!speedOption || !['slow', 'normal', 'fast'].includes(speedOption)) {
                await sendCommandResponse(message, 'Please specify a valid speed: slow, normal, or fast.', deleteTimeout, true);
                return;
            }
            
            if (speedOption === 'slow') {
                DELETE_INTERVAL_MIN = 12000;
                DELETE_INTERVAL_MAX = 25000;
                JITTER_FACTOR = 0.5;
                PAUSE_CHANCE = 0.25;
                PAUSE_LENGTH_MIN = 45000;
                PAUSE_LENGTH_MAX = 180000;
                BATCH_SIZE = 2;
            } else if (speedOption === 'fast') {
                DELETE_INTERVAL_MIN = 5000;
                DELETE_INTERVAL_MAX = 10000;
                JITTER_FACTOR = 0.3;
                PAUSE_CHANCE = 0.1;
                PAUSE_LENGTH_MIN = 15000;
                PAUSE_LENGTH_MAX = 60000;
                BATCH_SIZE = 5;
            } else {
                DELETE_INTERVAL_MIN = 8000;
                DELETE_INTERVAL_MAX = 15000;
                JITTER_FACTOR = 0.4;
                PAUSE_CHANCE = 0.15;
                PAUSE_LENGTH_MIN = 30000;
                PAUSE_LENGTH_MAX = 120000;
                BATCH_SIZE = 3;
            }
            
            await sendCommandResponse(message, `Auto-delete speed set to ${speedOption}.`, deleteTimeout, true);
            return;
        }

        await sendCommandResponse(
            message,
            'Unknown command. Available options: on/off, status, clear, speed [slow/normal/fast]',
            deleteTimeout,
            true
        );
    },
};