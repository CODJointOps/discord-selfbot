const { DiscordStreamClient } = require('discord-stream-client');

module.exports = {
  name: 'livestream',
  description: 'Starts or stops a live stream in a voice channel with a provided video link.',
  async execute(message, args, deleteTimeout) {
    if (args[0] === 'stop') {
      if (message.client.voiceConnection) {
        message.client.voiceConnection.disconnect();
        message.client.voiceConnection = null;

        if (message.client.currentPlayer) {
          message.client.currentPlayer.stop();
          message.client.currentPlayer.removeAllListeners('end');
          message.client.currentPlayer = null;
        }

        return message.channel.send('Livestream stopped.').then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
      } else {
        return message.channel.send('No active livestream to stop.').then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
      }
    }

    if (args.length < 2) {
      return message.channel.send('Usage: .livestream <channelId> <videoLink> | .livestream stop')
        .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
    }

    const channelId = args[0];
    const videoLink = args[1];
    const channel = message.client.channels.cache.get(channelId);
    
    if (!channel) {
      return message.channel.send('Channel not found.')
        .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
    }

    const voiceState = message.guild.members.me.voice;
    if (voiceState.channel) {
    	console.log('Already in a voice channel, leaving...');
  	await voiceState.disconnect();
    }

    try {
      if (message.client.currentPlayer) {
        message.client.currentPlayer.stop();
      }

      const connection = await message.client.streamClient.joinVoiceChannel(channel, {
        selfDeaf: true,
        selfMute: true,
        selfVideo: false,
      });

      const stream = await connection.createStream();
      const player = message.client.streamClient.createPlayer(videoLink, stream.udp);
      message.client.currentPlayer = player;

      player.on('error', err => console.error(err));

      const playStream = () => {
        player.play(videoLink, {
          kbpsVideo: 7000,
          fps: 60,
          hwaccel: true,
          kbpsAudio: 128,
          volume: 1,
        });
      };

      player.on('finish', () => {
        console.log('Media ended, replaying...');
        playStream();
      });

      playStream(); 

      message.channel.send('Livestream started with the provided video link.')
        .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));

    } catch (error) {
      console.error(error);
      message.channel.send('Failed to start the livestream.')
        .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
    }
  },
};

