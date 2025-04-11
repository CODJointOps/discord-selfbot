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
    // First try to split by commas
    let parts = input.split(',').map(part => part.trim()).filter(part => part !== '');
    
    // If we only have one part, try splitting by spaces
    if (parts.length === 1) {
        parts = input.split(/\s+/).filter(part => part !== '');
    }
    
    return parts
        .map(part => extractUserId(part))
        .filter(id => id !== null);
}

module.exports = {
    extractUserId,
    processUserInput
}; 