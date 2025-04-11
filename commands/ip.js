let vpnRangesCache = null;
const { sendCommandResponse } = require('../utils/messageUtils');

function ipToInt(ip) {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function cidrContains(cidr, ip) {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    const ipInt = ipToInt(ip);
    const rangeInt = ipToInt(range);
    const mask = ~(2 ** (32 - bits) - 1) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
}

function isVpnIp(ip) {
    if (!vpnRangesCache) return false;
    for (const cidr of vpnRangesCache) {
        if (cidrContains(cidr, ip)) {
            return true;
        }
    }
    return false;
}

function isValidIp(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

module.exports = {
    name: 'ip',
    description: 'Fetches IP info and checks if the IP is a VPN. Usage: .ip [ip_address]',
    async execute(message, args, deleteTimeout) {
        const { default: fetch } = await import('node-fetch');
        try {
            let targetIp;
            
            if (args.length > 0) {
                targetIp = args[0];
                if (!isValidIp(targetIp)) {
                    await sendCommandResponse(message, "Invalid IP address format. Please use format: x.x.x.x", deleteTimeout, true);
                    return;
                }
            } else {
                const ipRes = await fetch('http://ip-api.com/json/');
                const data = await ipRes.json();
                targetIp = data.query;
            }

            if (!vpnRangesCache) {
                const vpnRes = await fetch('https://raw.githubusercontent.com/X4BNet/lists_vpn/main/ipv4.txt');
                const vpnText = await vpnRes.text();
                vpnRangesCache = vpnText.split('\n').map(line => line.trim()).filter(line => line);
            }

            const ipRes = await fetch(`http://ip-api.com/json/${targetIp}`);
            const data = await ipRes.json();

            if (data.status === 'fail') {
                await sendCommandResponse(message, `Error: ${data.message}`, deleteTimeout, true);
                return;
            }

            const ip = data.query || "Unknown";
            const vpnCheck = isVpnIp(ip);

            const hostname = data.hostname || "Unknown";
            const city = data.city || "Unknown";
            const region = data.regionName || "Unknown";
            const country = data.country || "Unknown";
            const timezone = data.timezone || "Unknown";
            const zip = data.zip || "Unknown";
            const isp = data.isp || "Unknown";
            const org = data.org || "Unknown";
            const as = data.as || "Unknown";

            const output =
                `IP: ${ip}
Hostname: ${hostname}
City: ${city}
Region: ${region}
Country: ${country}
Time Zone: ${timezone}
ZIP: ${zip}
ISP: ${isp}
Organization: ${org}
AS: ${as}
VPN: ${vpnCheck ? "True" : "False"}`;

            await sendCommandResponse(message, `\`\`\`\n${output}\n\`\`\``, 30000, true);
        } catch (error) {
            console.error("Error fetching IP info:", error);
            await sendCommandResponse(message, "Error fetching IP info.", deleteTimeout, true);
        }
    },
};