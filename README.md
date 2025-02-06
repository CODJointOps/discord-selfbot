## Description

`discord-selfbot` is a simple selfbot for discord using [discord.js-selfbot-v13](https://github.com/aiko-chan-ai/discord.js-selfbot-v13).

# Discord Selfbot Setup

## 1. Clone the Repository
Open your terminal and run:
```bash
git clone https://git.deadzone.lol/Wizzard/discord-selfbot/
cd discord-selfbot
```
Run start.sh / start.bat

## 2. Get your token
Open the file `tokengrab.js` in a text editor.

Copy its entire contents.

Open the Discord client and press Ctrl+Shift+I to open Developer Tools.

Navigate to the Console tab.

Paste the copied contents into the console and press Enter.

## 3. Configuration
Create your configuration file by copying the example file:

`cp EXAMPLE.env .env` (copy file on windows)

Replace the placeholder for DISCORD_TOKEN with your actual Discord token. For example:

```
DISCORD_TOKEN=discord_token
PREFIX=.
```

## Disclaimer

I don't take any responsibility for blocked Discord accounts that used this program.
Using this on a user account is prohibited by the Discord TOS and can lead to the account block.