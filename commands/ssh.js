const { Client: SSHClient } = require('ssh2');

let sshConnection = null;

module.exports = {
    name: 'ssh',
    description: 'Manage an SSH connection. Subcommands: connect, exec, disconnect',
    async execute(message, args, deleteTimeout) {
        if (!args.length) {
            return message.channel
                .send("Usage: `.ssh <connect|exec|disconnect> ...`")
                .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
        }

        const subcommand = args.shift().toLowerCase();

        if (subcommand === 'connect') {
            if (args.length < 3) {
                return message.channel
                    .send("Usage: `.ssh connect <host> <username> <password> [port]`")
                    .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            }

            if (sshConnection) {
                return message.channel
                    .send("Already connected. Disconnect first using `.ssh disconnect`.")
                    .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            }

            const host = args[0];
            const username = args[1];
            const password = args[2];
            const port = args[3] ? parseInt(args[3]) : 22;

            sshConnection = new SSHClient();

            sshConnection
                .on('ready', () => {
                    message.channel
                        .send(`Connected to ${host}`)
                        .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                })
                .on('error', (err) => {
                    message.channel
                        .send(`SSH Connection error: ${err.message}`)
                        .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                    sshConnection = null;
                })
                .on('close', () => {
                    message.channel
                        .send(`SSH Connection closed.`)
                        .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                    sshConnection = null;
                });

            sshConnection.connect({ host, port, username, password });
            return;
        }

        else if (subcommand === 'exec') {
            if (!sshConnection) {
                return message.channel
                    .send("No active SSH connection. Connect first using `.ssh connect ...`")
                    .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            }
            if (!args.length) {
                return message.channel
                    .send("Usage: `.ssh exec <command>`")
                    .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            }

            const cmd = args.join(' ');

            sshConnection.exec(cmd, (err, stream) => {
                if (err) {
                    return message.channel
                        .send(`Error executing command: ${err.message}`)
                        .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
                }

                let outputBuffer = '';

                message.channel.send(`Executing command: \`${cmd}\`\n\`\`\`\n...\n\`\`\``)
                    .then((sentMsg) => {
                        const updateInterval = setInterval(() => {
                            let display = outputBuffer;
                            if (display.length > 1900) {
                                display = display.slice(-1900);
                            }
                            sentMsg.edit(`Executing command: \`${cmd}\`\n\`\`\`\n${display}\n\`\`\``)
                                .catch(() => { });
                        }, 2000);

                        stream.on('data', (data) => {
                            outputBuffer += data.toString();
                        });
                        stream.stderr.on('data', (data) => {
                            outputBuffer += data.toString();
                        });
                        stream.on('close', (code, signal) => {
                            clearInterval(updateInterval);
                            outputBuffer += `\nProcess exited with code ${code}${signal ? ' and signal ' + signal : ''}`;
                            let display = outputBuffer;
                            if (display.length > 1900) {
                                display = display.slice(-1900);
                            }
                            sentMsg.edit(`Executing command: \`${cmd}\`\n\`\`\`\n${display}\n\`\`\``)
                                .catch(() => { });
                        });
                    })
                    .catch(console.error);
            });
            return;
        }

        else if (subcommand === 'disconnect') {
            if (!sshConnection) {
                return message.channel
                    .send("No active SSH connection.")
                    .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
            }
            sshConnection.end();
            sshConnection = null;
            return message.channel
                .send("Disconnecting SSH...")
                .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
        }

        else {
            return message.channel
                .send("Unknown subcommand. Use `connect`, `exec`, or `disconnect`.")
                .then((msg) => setTimeout(() => msg.delete().catch(() => { }), deleteTimeout));
        }
    },
};