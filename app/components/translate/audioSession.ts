'use client';

// Safari's audio session (16.4+): left to choose for itself while Talk
// records, and asked for plain playback before a translation plays, so it
// comes from the speaker rather than the earpiece the microphone left it on.
// Other browsers have none, and nothing happens.

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export function setAudioSession(type: 'auto' | 'playback'): void {
    try {
        const session = (navigator as AudioSessionNavigator).audioSession;
        if (session && session.type !== type) session.type = type;
    } catch { /* not supported */ }
}
