const getHumanizedDeleteDelay = (baseDelay = 5000) => {
    const jitter = Math.floor(Math.random() * 2000) - 1000;
    return Math.max(1500, baseDelay + jitter);
};

const sendTempMessage = async (channel, content, baseDeleteDelay = 5000) => {
    if (channel.id === 'console') {
        return channel.send(content);
    }
    
    try {
        const deleteDelay = getHumanizedDeleteDelay(baseDeleteDelay);
        const sentMessage = await channel.send(content);
        
        sentMessage.scheduledForDeletion = true;
        
        console.log(`[MESSAGE] Sending temp message in ${channel.id}, will delete in ${deleteDelay}ms`);
        
        setTimeout(() => {
            if (Math.random() < 0.1) {
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
    if (deleteOriginal) {
        try {
            const cmdDeleteDelay = Math.floor(Math.random() * 1000) + 500;
            setTimeout(() => message.delete().catch(() => {}), cmdDeleteDelay);
        } catch (error) {
            console.error('[MESSAGE] Error deleting original command:', error);
        }
    }
    
    return await sendTempMessage(message.channel, content, baseDeleteDelay);
};

module.exports = {
    getHumanizedDeleteDelay,
    sendTempMessage,
    sendCommandResponse
}; 