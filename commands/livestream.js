const { DiscordStreamClient } = require('discord-stream-client');

module.exports = {
  name: 'livestream',
  description: 'Starts a live stream in a voice channel with a provided video link.',
  async execute(message, args, deleteTimeout) {
    if (args.length < 2) {
      return message.channel.send('Usage: .livestream <channelId> <videoLink>')
        .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
    }
    
    const channelId = args[0];
    const videoLink = args[1];
    const channel = message.client.channels.cache.get(channelId);
    
    if (!channel) {
      return message.channel.send('Channel not found.')
        .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
    }

    try {
      const connection = await message.client.streamClient.joinVoiceChannel(channel, {
        selfDeaf: true,
        selfMute: true,
        selfVideo: false,
      });
      
      const stream = await connection.createStream();
      const player = message.client.streamClient.createPlayer(videoLink, stream.udp);

      player.on('error', err => console.error(err));
      
      player.play({
        kbpsVideo: 7000,
        fps: 60,
        hwaccel: true,
        kbpsAudio: 128,
        volume: 1,
      });

      message.channel.send('Livestream started with the provided video link.')
        .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));

    } catch (error) {
      console.error(error);
      message.channel.send('Failed to start the livestream.')
        .then(msg => setTimeout(() => msg.delete().catch(console.error), deleteTimeout));
    }
  },
};

