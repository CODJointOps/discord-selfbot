let targetUserId = null;
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
    description: 'Automatically kicks a specified user from voice channels.',
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
            targetUserId = null;
            lastKickTime = 0;
            consecutiveKicks = 0;
            cooldownTime = 0;

            console.log('[KICKVC] System deactivated - all variables reset');
            message.channel.send('Voice kick has been deactivated.')
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
            return;
        }

        const userId = args[0];
        if (!userId || !/^\d{17,19}$/.test(userId)) {
            console.log('[KICKVC] Invalid user ID provided');
            message.channel.send('Please provide a valid user ID.')
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
            return;
        }

        targetUserId = userId;
        isKickActive = true;
        console.log(`[KICKVC] System activated - Targeting user ID: ${userId}`);

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
                const delay = fromEvent ? getRandomDelay() : getRandomCheckDelay();
                console.log(`[KICKVC] Waiting ${delay}ms before kick attempt...`);
                await new Promise(resolve => setTimeout(resolve, delay));

                if (!member.voice.channel) {
                    console.log('[KICKVC] Target no longer in voice after delay');
                    return;
                }

                console.log(`[KICKVC] Target detected in voice: ${member.user.tag} | Server: ${guild.name} | Channel: ${member.voice.channel.name}`);

                await member.voice.disconnect();
                lastKickTime = currentTime;
                consecutiveKicks++;

                const oldCooldown = cooldownTime;
                cooldownTime = getCooldown(consecutiveKicks);

                console.log(`[KICKVC] Kick successful - Consecutive kicks: ${consecutiveKicks} | New cooldown: ${cooldownTime}ms (was ${oldCooldown}ms)`);

                setTimeout(() => {
                    if (consecutiveKicks > 0) {
                        const oldKicks = consecutiveKicks;
                        const oldCd = cooldownTime;
                        consecutiveKicks--;
                        cooldownTime = getCooldown(consecutiveKicks);
                        console.log(`[KICKVC] Decay timer - Kicks reduced: ${oldKicks} -> ${consecutiveKicks} | Cooldown: ${oldCd}ms -> ${cooldownTime}ms`);
                    }
                }, 15000);

            } catch (error) {
                console.log('[KICKVC] Primary disconnect failed, trying alternate methods');
                try {
                    await member.voice.setChannel(null);
                    console.log('[KICKVC] Alternate method 1 successful (setChannel null)');
                } catch {
                    try {
                        await member.voice.channel.permissionOverwrites.create(member, {
                            Connect: false,
                            Speak: false
                        });
                        await member.voice.disconnect();
                        console.log('[KICKVC] Alternate method 2 successful (permissions + disconnect)');
                    } catch {
                        console.log('[KICKVC] All disconnection methods failed');
                    }
                }
            }
        };

        voiceStateHandler = async (oldState, newState) => {
            if (!isKickActive || !targetUserId) return;

            const isTargetUser = newState?.member?.id === targetUserId || oldState?.member?.id === targetUserId;
            if (!isTargetUser) return;

            const voiceState = newState?.channelId ? newState : oldState;
            if (!voiceState?.channel) return;

            console.log('[KICKVC] Voice state update detected for target');

            try {
                const guild = voiceState.guild;
                const member = await guild.members.fetch(targetUserId).catch(() => null);
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
                try {
                    const member = await guild.members.fetch(targetUserId).catch(() => null);
                    if (member?.voice?.channel) {
                        await kickUser(member, guild, false);
                    }
                } catch { }
            }
        }, intervalTime);

        message.client.on('voiceStateUpdate', voiceStateHandler);
        console.log('[KICKVC] New voice state handler and check interval registered');

        try {
            const user = await message.client.users.fetch(userId);
            console.log(`[KICKVC] Successfully fetched target user: ${user.tag}`);
            message.channel.send(`Now automatically kicking ${user.tag} (${userId}) from voice channels.`)
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));

            console.log('[KICKVC] Performing initial guild check');
            message.client.guilds.cache.forEach(async (guild) => {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member?.voice?.channel) {
                    console.log(`[KICKVC] Target found in voice during initial check - Server: ${guild.name}`);
                    await kickUser(member, guild, true);
                }
            });
        } catch (error) {
            console.log('[KICKVC] Could not fetch user information:', error);
            message.channel.send(`Now automatically kicking user ID ${userId} from voice channels.`)
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
        }
    },
};