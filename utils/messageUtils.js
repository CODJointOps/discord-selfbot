const getHumanizedDeleteDelay = (baseDelay = 5000) => {
    // Add randomness to deletion timing for more human-like behavior
    const jitter = Math.floor(Math.random() * 2000) - 1000; // -1000 to +1000ms jitter
    return Math.max(1500, baseDelay + jitter);
};

const sendTempMessage = async (channel, content, baseDeleteDelay = 5000) => {
    try {
        const deleteDelay = getHumanizedDeleteDelay(baseDeleteDelay);
        const sentMessage = await channel.send(content);
        
        // Log what's happening for debugging
        console.log(`[MESSAGE] Sending temp message in ${channel.id}, will delete in ${deleteDelay}ms`);
        
        // Simulate a human, occasionally delayed deletion
        setTimeout(() => {
            if (Math.random() < 0.1) {
                // 10% chance for an extra delay (simulates forgetting to delete immediately)
                const extraDelay = Math.floor(Math.random() * 3000) + 1000;
                console.log(`[MESSAGE] Adding ${extraDelay}ms extra delay before deletion`);
                setTimeout(() => sentMessage.delete().catch(err => console.error('[MESSAGE] Delete error:', err)), extraDelay);
            } else {
                sentMessage.delete().catch(err => console.error('[MESSAGE] Delete error:', err));
            }
        }, deleteDelay);
        
        return sentMessage;
    } catch (error) {
        console.error('[MESSAGE] Error sending temporary message:', error);
        return null;
    }
};

const sendCommandResponse = async (message, content, baseDeleteDelay = 5000, deleteOriginal = true) => {
    // Delete original command message if requested
    if (deleteOriginal) {
        try {
            // Add small delay before deleting command, like a human would
            const cmdDeleteDelay = Math.floor(Math.random() * 1000) + 500;
            setTimeout(() => message.delete().catch(() => {}), cmdDeleteDelay);
        } catch (error) {
            console.error('[MESSAGE] Error deleting original command:', error);
        }
    }
    
    // Send and schedule deletion of response
    return await sendTempMessage(message.channel, content, baseDeleteDelay);
};

module.exports = {
    getHumanizedDeleteDelay,
    sendTempMessage,
    sendCommandResponse
}; 