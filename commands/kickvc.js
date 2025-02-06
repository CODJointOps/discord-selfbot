let targetUserIds = [];
let isKickActive = false;
let voiceStateHandler = null;
let lastKickTime = 0;
let consecutiveKicks = 0;
let cooldownTime = 0;
let checkInterval = null;

const getRandomDelay = () => {
    const delay = Math.floor(Math.random() * 250) + 100;
    console.log(`[KICKVC] Generated event delay: ${delay}ms`);
    return delay;
};

const getRandomCheckDelay = () => {
    const delay = Math.floor(Math.random() * 250) + 200;
    console.log(`[KICKVC] Generated interval check delay: ${delay}ms`);
    return delay;
};

const getCooldown = (kicks) => {
    let cooldown;
    if (kicks <= 3) cooldown = 200;
    else if (kicks <= 5) cooldown = 500;
    else if (kicks <= 10) cooldown = 1000;
    else cooldown = 2500;
    console.log(`[KICKVC] New cooldown calculated for ${kicks} kicks: ${cooldown}ms`);
    return cooldown;
};

module.exports = {
    name: 'kickvc',
    description: 'Automatically kicks specified users from voice channels.',
    async execute(message, args, deleteTimeout) {
        if (args[0]?.toLowerCase() === 'stop') {
            if (voiceStateHandler) {
                message.client.removeListener('voiceStateUpdate', voiceStateHandler);
                voiceStateHandler = null;
            }
            if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
            isKickActive = false;
            targetUserIds = [];
            lastKickTime = 0;
            consecutiveKicks = 0;
            cooldownTime = 0;
            console.log('[KICKVC] System deactivated - all variables reset');
            message.channel.send('Voice kick has been deactivated.')
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
            return;
        }
        const userIds = args.filter(arg => /^\d{17,19}$/.test(arg));
        if (!userIds.length) {
            console.log('[KICKVC] Invalid user IDs provided');
            message.channel.send('Please provide at least one valid user ID.')
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
            return;
        }
        targetUserIds = userIds;
        isKickActive = true;
        console.log(`[KICKVC] System activated - Targeting user IDs: ${targetUserIds.join(', ')}`);
        if (voiceStateHandler) {
            message.client.removeListener('voiceStateUpdate', voiceStateHandler);
            console.log('[KICKVC] Removed old voice state handler');
        }
        if (checkInterval) {
            clearInterval(checkInterval);
            console.log('[KICKVC] Cleared old check interval');
        }
        const kickUser = async (member, guild, fromEvent = false) => {
            if (!isKickActive) return;
            const currentTime = Date.now();
            const timeSinceLastKick = currentTime - lastKickTime;
            if (timeSinceLastKick < cooldownTime) {
                console.log(`[KICKVC] On cooldown - ${cooldownTime - timeSinceLastKick}ms remaining`);
                return;
            }
            try {
                const selfMember = await guild.members.fetch(member.client.user.id);
                if (!selfMember.permissions.has("ADMINISTRATOR")) {
                    console.log(`[KICKVC] No admin permissions in ${guild.name}, skipping`);
                    return;
                }
                const delay = fromEvent ? getRandomDelay() : getRandomCheckDelay();
                console.log(`[KICKVC] Admin check passed in ${guild.name}, waiting ${delay}ms before kick...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                if (!member.voice.channel) return;
                console.log(`[KICKVC] Target in voice: ${member.user.tag} | ${guild.name} | ${member.voice.channel.name}`);
                await member.voice.disconnect();
                lastKickTime = currentTime;
                consecutiveKicks++;
                cooldownTime = getCooldown(consecutiveKicks);
                setTimeout(() => {
                    if (consecutiveKicks > 0) {
                        consecutiveKicks--;
                        cooldownTime = getCooldown(consecutiveKicks);
                    }
                }, 15000);
            } catch (error) {
                console.log(`[KICKVC] Error kicking in ${guild.name}:`, error);
                try {
                    await member.voice.setChannel(null);
                    console.log('[KICKVC] Succeeded with alternate method (setChannel null)');
                } catch {
                    try {
                        await member.voice.channel.permissionOverwrites.create(member, {
                            Connect: false,
                            Speak: false
                        });
                        await member.voice.disconnect();
                        console.log('[KICKVC] Succeeded with permissions override');
                    } catch {
                        console.log('[KICKVC] All disconnect methods failed');
                    }
                }
            }
        };
        voiceStateHandler = async (oldState, newState) => {
            if (!isKickActive || targetUserIds.length === 0) return;
            const id = newState?.member?.id || oldState?.member?.id;
            if (!targetUserIds.includes(id)) return;
            const voiceState = newState?.channelId ? newState : oldState;
            if (!voiceState?.channel) return;
            console.log('[KICKVC] Voice state update detected for target');
            try {
                const guild = voiceState.guild;
                const member = await guild.members.fetch(id).catch(() => null);
                if (member?.voice?.channel) {
                    await kickUser(member, guild, true);
                }
            } catch (error) {
                console.log('[KICKVC] Error in voice state handler:', error);
            }
        };
        const intervalTime = Math.floor(Math.random() * 500) + 1000;
        console.log(`[KICKVC] Setting up interval check every ${intervalTime}ms`);
        checkInterval = setInterval(async () => {
            if (!isKickActive) return;
            for (const guild of message.client.guilds.cache.values()) {
                for (const id of targetUserIds) {
                    try {
                        const member = await guild.members.fetch(id).catch(() => null);
                        if (member?.voice?.channel) {
                            await kickUser(member, guild, false);
                        }
                    } catch { }
                }
            }
        }, intervalTime);
        message.client.on('voiceStateUpdate', voiceStateHandler);
        console.log('[KICKVC] New voice state handler and check interval registered');
        try {
            const users = await Promise.all(targetUserIds.map(id => message.client.users.fetch(id).catch(() => null)));
            const userTags = users.filter(u => u).map(u => `${u.tag} (${u.id})`);
            console.log(`[KICKVC] Successfully fetched target users: ${userTags.join(', ')}`);
            message.channel.send(`Now automatically kicking: ${userTags.join(', ')} from voice channels.`)
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
            console.log('[KICKVC] Performing initial guild check');
            message.client.guilds.cache.forEach(async (guild) => {
                for (const id of targetUserIds) {
                    const member = await guild.members.fetch(id).catch(() => null);
                    if (member?.voice?.channel) {
                        console.log(`[KICKVC] Target found in voice during initial check - Server: ${guild.name}`);
                        await kickUser(member, guild, true);
                    }
                }
            });
        } catch (error) {
            console.log('[KICKVC] Could not fetch user information:', error);
            message.channel.send(`Now automatically kicking user IDs: ${targetUserIds.join(', ')} from voice channels.`)
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
        }
    },
};