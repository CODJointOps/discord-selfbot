function extractUserId(input) {
    if (/^\d{17,19}$/.test(input)) {
        return input;
    }

    const mentionRegex = /<@!?(\d{17,19})>/;
    const match = input.match(mentionRegex);

    if (match && match[1]) {
        return match[1];
    }

    return null;
}

function processUserInput(input) {
    return input
        .split(',')
        .map(part => part.trim())
        .map(part => extractUserId(part))
        .filter(id => id !== null);
}

module.exports = {
    extractUserId,
    processUserInput
}; 