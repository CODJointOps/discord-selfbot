let vpnRangesCache = null;

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

module.exports = {
    name: 'ip',
    description: 'Fetches IP info and checks if the IP is a VPN.',
    async execute(message, args, deleteTimeout) {
        const { default: fetch } = await import('node-fetch');
        try {
            const ipRes = await fetch('http://ip-api.com/json/');
            const data = await ipRes.json();

            if (!vpnRangesCache) {
                const vpnRes = await fetch('https://raw.githubusercontent.com/X4BNet/lists_vpn/main/ipv4.txt');
                const vpnText = await vpnRes.text();
                vpnRangesCache = vpnText.split('\n').map(line => line.trim()).filter(line => line);
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
                `Hostname: ${hostname}
City: ${city}
Region: ${region}
Country: ${country}
Time Zone: ${timezone}
ZIP: ${zip}
ISP: ${isp}
Organization: ${org}
AS: ${as}
VPN: ${vpnCheck ? "True" : "False"}`;

            message.channel.send(`\`\`\`\n${output}\n\`\`\``)
                .then(sentMsg => setTimeout(() => sentMsg.delete().catch(console.error), 30000));
        } catch (error) {
            console.error("Error fetching IP info:", error);
            message.channel.send("Error fetching IP info.")
                .then(sentMsg => setTimeout(() => sentMsg.delete().catch(console.error), deleteTimeout));
        }
    },
};