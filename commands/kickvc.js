let targetUserId = null;
let isKickActive = false;
let voiceStateHandler = null;
let lastKickTime = 0;
let consecutiveKicks = 0;
let cooldownTime = 0;
let checkInterval = null;

const getRandomDelay = () => {
    return Math.floor(Math.random() * 250) + 100;
};

const getRandomCheckDelay = () => {
    return Math.floor(Math.random() * 250) + 200;
};

const getCooldown = (kicks) => {
    if (kicks <= 3) return 200;
    if (kicks <= 5) return 500;
    if (kicks <= 10) return 1000;
    return 2000;
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
            message.channel.send('Please provide a valid user ID.')
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
            return;
        }

        targetUserId = userId;
        isKickActive = true;
        console.log(`[KICKVC] System activated - Targeting user ID: ${userId}`);

        if (voiceStateHandler) {
            message.client.removeListener('voiceStateUpdate', voiceStateHandler);
        }
        if (checkInterval) {
            clearInterval(checkInterval);
        }

        const kickUser = async (member, guild, fromEvent = false) => {
            if (!isKickActive) return;

            const currentTime = Date.now();
            const timeSinceLastKick = currentTime - lastKickTime;

            if (timeSinceLastKick < cooldownTime) {
                return;
            }

            try {
                const delay = fromEvent ? getRandomDelay() : getRandomCheckDelay();
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

            } catch {
                try {
                    await member.voice.setChannel(null);
                } catch {
                    try {
                        await member.voice.channel.permissionOverwrites.create(member, {
                            Connect: false,
                            Speak: false
                        });
                        await member.voice.disconnect();
                    } catch { }
                }
            }
        };

        voiceStateHandler = async (oldState, newState) => {
            if (!isKickActive || !targetUserId) return;

            const isTargetUser = newState?.member?.id === targetUserId || oldState?.member?.id === targetUserId;
            if (!isTargetUser) return;

            const voiceState = newState?.channelId ? newState : oldState;
            if (!voiceState?.channel) return;

            try {
                const guild = voiceState.guild;
                const member = await guild.members.fetch(targetUserId).catch(() => null);
                if (member?.voice?.channel) {
                    await kickUser(member, guild, true);
                }
            } catch { }
        };

        const intervalTime = Math.floor(Math.random() * 500) + 1000;
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

        try {
            const user = await message.client.users.fetch(userId);
            message.channel.send(`Now automatically kicking ${user.tag} (${userId}) from voice channels.`)
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));

            message.client.guilds.cache.forEach(async (guild) => {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member?.voice?.channel) {
                    await kickUser(member, guild, true);
                }
            });
        } catch {
            message.channel.send(`Now automatically kicking user ID ${userId} from voice channels.`)
                .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
        }
    },
};