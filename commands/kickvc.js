const { extractUserId } = require('../utils/userUtils');
const { sendCommandResponse } = require('../utils/messageUtils');

let activeKicks = new Map();
let cooldowns = new Map();
let voiceStateUpdateHandlers = new Map();
let checkIntervals = new Map();

const getKickDelay = () => {
    const baseDelay = Math.floor(Math.random() * 400) + 600;
    const jitter = Math.floor(Math.random() * 200) - 100;
    return Math.max(400, baseDelay + jitter);
};

const calculateCooldown = (kickCount) => {
    if (kickCount <= 2) return 0;
    if (kickCount <= 5) return Math.min((kickCount - 2) * 300, 900);
    if (kickCount <= 10) return Math.min(900 + (kickCount - 5) * 400, 2900);
    return Math.min(2900 + (kickCount - 10) * 500, 5000);
};

const getSafetyPause = () => {
    if (Math.random() < 0.25) {
        return Math.floor(Math.random() * 4000) + 3000;
    }
    return 0;
};

const performUserKick = async (userId, guild, voiceChannel, kickData) => {
    if (!activeKicks.has(userId)) return false;
    
    try {
        const member = guild.members.cache.get(userId);
        if (!member || !member.voice.channelId) return false;
        
        console.log(`[KICKVC] Found user ${userId} in VC: ${voiceChannel.name}`);
        
        const currentTime = Date.now();
        const lastKickTime = kickData.lastKick;
        const timeSinceLastKick = currentTime - lastKickTime;
        
        let cooldownTime = cooldowns.get(userId) || 0;
        
        if (timeSinceLastKick < 3000) {
            cooldownTime = calculateCooldown(kickData.count);
            cooldowns.set(userId, cooldownTime);
        }
        
        if (cooldownTime > 0) {
            console.log(`[KICKVC] Cooldown active for ${userId}: ${cooldownTime}ms`);
            await new Promise(resolve => setTimeout(resolve, cooldownTime));
        }
        
        const safetyPause = getSafetyPause();
        if (safetyPause > 0) {
            console.log(`[KICKVC] Adding safety pause of ${safetyPause}ms before kicking ${userId}`);
            await new Promise(resolve => setTimeout(resolve, safetyPause));
        }
        
        const delay = getKickDelay();
        console.log(`[KICKVC] Will kick ${userId} after ${delay}ms delay`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (!activeKicks.has(userId)) {
            console.log(`[KICKVC] Kick for ${userId} was stopped during delay`);
            return false;
        }
        
        if (member && member.voice.channelId) {
            await member.voice.disconnect();
            
            kickData.count++;
            kickData.lastKick = Date.now();
            activeKicks.set(userId, kickData);
            
            console.log(`[KICKVC] Successfully kicked ${userId} (${kickData.count} kicks so far)`);
            
            if (kickData.count % 5 === 0) {
                cooldowns.set(userId, calculateCooldown(kickData.count) + 2000);
                console.log(`[KICKVC] Increased cooldown after ${kickData.count} kicks`);
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.log(`[KICKVC] Failed to kick ${userId}:`, error);
        
        if (Math.random() < 0.3 && kickData.count > 0) {
            setTimeout(() => {
                try {
                    const member = guild.members.cache.get(userId);
                    if (member && member.voice.channelId) {
                        member.voice.disconnect().catch(e => 
                            console.log(`[KICKVC] Retry failed for ${userId}:`, e)
                        );
                    }
                } catch (retryError) {
                    console.log(`[KICKVC] Retry setup failed for ${userId}:`, retryError);
                }
            }, 2000 + Math.random() * 1000);
        }
        
        return false;
    }
};

module.exports = {
    name: 'kickvc',
    description: 'Automatically kicks specified users from voice channels.',
    async execute(message, args, deleteTimeout) {
        if (args.length === 0) {
            await sendCommandResponse(message, 'Please provide a command: `start <userId(s)>` or `stop <userId or "all">`', deleteTimeout, true);
            return;
        }

        const command = args[0].toLowerCase();

        if (command === 'stop') {
            if (args.length < 2) {
                await sendCommandResponse(message, 'Please specify a user ID or "all" to stop kicking.', deleteTimeout, true);
                return;
            }

            const target = args[1].toLowerCase();
            
            if (target === 'all') {
                for (const [userId, handler] of voiceStateUpdateHandlers.entries()) {
                    message.client.off('voiceStateUpdate', handler);
                    activeKicks.delete(userId);
                    cooldowns.delete(userId);
                    clearInterval(checkIntervals.get(userId));
                    checkIntervals.delete(userId);
                    console.log(`[KICKVC] Stopped kicking user: ${userId}`);
                }
                voiceStateUpdateHandlers.clear();
                
                await sendCommandResponse(message, 'Stopped all active VC kicks.', deleteTimeout, true);
                return;
            } else {
                const userId = extractUserId(target);
                
                if (!userId) {
                    await sendCommandResponse(message, 'Invalid user ID.', deleteTimeout, true);
                    return;
                }

                if (voiceStateUpdateHandlers.has(userId)) {
                    message.client.off('voiceStateUpdate', voiceStateUpdateHandlers.get(userId));
                    activeKicks.delete(userId);
                    cooldowns.delete(userId);
                    clearInterval(checkIntervals.get(userId));
                    checkIntervals.delete(userId);
                    console.log(`[KICKVC] Stopped kicking user: ${userId}`);
                    
                    await sendCommandResponse(message, `Stopped kicking user: ${userId}`, deleteTimeout, true);
                } else {
                    await sendCommandResponse(message, `No active kick for user: ${userId}`, deleteTimeout, true);
                }
                return;
            }
        }

        if (command === 'start') {
            if (args.length < 2) {
                await sendCommandResponse(message, 'Please provide at least one user ID to kick.', deleteTimeout, true);
                return;
            }

            const userIds = args.slice(1)
                .map(arg => extractUserId(arg))
                .filter(id => id !== null);

            if (userIds.length === 0) {
                await sendCommandResponse(message, 'No valid user IDs provided.', deleteTimeout, true);
                return;
            }

            const startedKicking = [];
            const alreadyKicking = [];

            for (const userId of userIds) {
                if (activeKicks.has(userId)) {
                    alreadyKicking.push(userId);
                    continue;
                }

                activeKicks.set(userId, { count: 0, lastKick: 0 });
                cooldowns.set(userId, 0);

                for (const guild of message.client.guilds.cache.values()) {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member && member.voice.channelId) {
                            const kickData = activeKicks.get(userId);
                            console.log(`[KICKVC] Found target ${userId} already in voice in ${guild.name}`);
                            performUserKick(userId, guild, member.voice.channel, kickData);
                            break;
                        }
                    } catch (error) {
                        console.log(`[KICKVC] Error checking guild ${guild.name} for user ${userId}:`, error);
                    }
                }

                const checkInterval = setInterval(async () => {
                    if (!activeKicks.has(userId)) {
                        clearInterval(checkInterval);
                        return;
                    }
                    
                    const kickData = activeKicks.get(userId);
                    
                    for (const guild of message.client.guilds.cache.values()) {
                        try {
                            const member = await guild.members.fetch(userId).catch(() => null);
                            if (member && member.voice.channelId) {
                                performUserKick(userId, guild, member.voice.channel, kickData);
                                return;
                            }
                        } catch (error) {}
                    }
                }, 4000 + Math.floor(Math.random() * 2000));
                
                checkIntervals.set(userId, checkInterval);

                const handleVoiceStateUpdate = async (oldState, newState) => {
                    if (!activeKicks.has(userId)) return;
                    
                    const member = newState.member || oldState.member;
                    if (!member || member.user.id !== userId) return;
                    
                    const kickData = activeKicks.get(userId);
                    
                    if ((!oldState.channelId && newState.channelId) || 
                        (oldState.channelId !== newState.channelId && newState.channelId)) {
                        
                        const guild = newState.guild;
                        const voiceChannel = newState.channel;
                        
                        console.log(`[KICKVC] Target user ${userId} joined/moved to VC: ${voiceChannel.name}`);
                        performUserKick(userId, guild, voiceChannel, kickData);
                    }
                };

                voiceStateUpdateHandlers.set(userId, handleVoiceStateUpdate);
                message.client.on('voiceStateUpdate', handleVoiceStateUpdate);
                startedKicking.push(userId);
                console.log(`[KICKVC] Started kicking user: ${userId}`);
            }

            if (startedKicking.length > 0) {
                await sendCommandResponse(
                    message,
                    `Started kicking: ${startedKicking.join(', ')}${alreadyKicking.length > 0 ? `\nAlready kicking: ${alreadyKicking.join(', ')}` : ''}`,
                    deleteTimeout,
                    true
                );
            } else if (alreadyKicking.length > 0) {
                await sendCommandResponse(message, `Already kicking: ${alreadyKicking.join(', ')}`, deleteTimeout, true);
            }
            return;
        }

        await sendCommandResponse(message, 'Unknown command. Use `start <userId(s)>` or `stop <userId or "all">`.', deleteTimeout, true);
    }
};