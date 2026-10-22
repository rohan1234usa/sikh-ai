import { MEASURE_RATE, voicedMs } from '@/lib/translate/talk';
import { MAX_AUDIO_BYTES, MIN_AUDIO_BYTES } from '@/lib/translate/voice';

// How much of a finished clip is at speech's loudness (voicedMs in
// lib/translate/talk.ts), measured from the clip itself. An
// OfflineAudioContext decodes it with no tap needed, unlike an AudioContext,
// which iOS and Chrome on Android start only from a tap that has ended (a
// finger's press is not one). Undefined when the browser can't decode its own
// recording, or for a clip the page refuses on its size alone: such a clip
// says nothing about its loudness, and the page's other checks decide.
export async function measureVoice(blob: Blob): Promise<number | undefined> {
    if (typeof OfflineAudioContext === 'undefined' || blob.size < MIN_AUDIO_BYTES || blob.size > MAX_AUDIO_BYTES) return undefined;
    try {
        const audio = await new OfflineAudioContext(1, 1, MEASURE_RATE).decodeAudioData(await blob.arrayBuffer());
        return voicedMs(audio.getChannelData(0), audio.sampleRate);
    } catch {
        return undefined;
    }
}
