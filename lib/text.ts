// Cuts text to at most `max` UTF-16 units without splitting a character: an
// emoji cut in half would reach an API as a lone surrogate, which it may
// refuse. The tutor caps what it sends Gemini with it (lib/learn/tutor.ts),
// and Talk what it sends to be read aloud (lib/translate/voice.ts).
export function cap(text: string, max: number): string {
    if (text.length <= max) return text;
    const last = text.charCodeAt(max - 1);
    return text.slice(0, last >= 0xd800 && last <= 0xdbff ? max - 1 : max);
}
