// SERVER-ONLY: Talk's read-aloud (/api/translate/speak, #37): a translated
// line in, an MP3 of Google Cloud Text-to-Speech reading it out. Do not import
// from client components: it reads a service account's private key.
//
// Cloud Text-to-Speech takes no API key (it answers "API keys are not
// supported by this API", checked 2026-10-13), so the server signs in as a
// service account: it signs a JWT with the account's key and trades it at
// Google's token endpoint for an access token, kept for its hour. That's a
// few lines of node:crypto rather than a client library. The account is
// GOOGLE_TTS_SERVICE_ACCOUNT, the JSON key file Google gives, as it is or in
// base64 (README, Running in production, step 8). Without one, read-aloud is
// off and the route says it isn't available.
//
// Like ./cloud.ts it's on a request path, so it times out fast, meters
// itself, never throws, and never logs the text or the key.

import { createSign } from 'node:crypto';
import { logRefusal } from '../api/refusals';
import { logEvent } from '../log';
import { charAllowance } from './cloud';
import type { SpeakLang } from './voice';

const API = 'https://texttospeech.googleapis.com';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const TIMEOUT_MS = 8000;

// Best-effort, like Cloud Translation's (./cloud.ts): each warm server keeps
// its own count, and a cold start resets it. 50,000 characters is a few
// hundred translations read aloud, about $0.20 a day at $4 a million.
export const SPEAK_DAILY_CHAR_CEILING = 50_000;
export const speakAllowance = charAllowance(SPEAK_DAILY_CHAR_CEILING);

// Punjabi's voices that are generally available are pa-IN Standard and
// WaveNet, A to D (Chirp 3 HD has pa-IN only in Preview). English is
// normally read by the visitor's own device; this voice is for a device
// that can't. SPEAK_VOICE_PA and SPEAK_VOICE_EN choose others by name.
const DEFAULT_VOICES: Record<SpeakLang, string> = { pa: 'pa-IN-Wavenet-A', en: 'en-US-Wavenet-F' };
const VOICE_ENV: Record<SpeakLang, string> = { pa: 'SPEAK_VOICE_PA', en: 'SPEAK_VOICE_EN' };

export type Voice = { languageCode: string; name: string };

export function speakVoice(lang: SpeakLang): Voice {
    const name = process.env[VOICE_ENV[lang]]?.trim() || DEFAULT_VOICES[lang];
    // A voice's name starts with its language: pa-IN-Wavenet-A is pa-IN.
    return { languageCode: name.split('-').slice(0, 2).join('-'), name };
}

type Account = { clientEmail: string; privateKey: string; keyId?: string; tokenUri: string };

function parseAccount(raw: string | undefined): Account | 'missing' | 'unreadable' {
    const text = raw?.trim();
    if (!text) return 'missing';
    try {
        const json = text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8');
        const key = JSON.parse(json) as Record<string, unknown>;
        if (typeof key.client_email !== 'string' || typeof key.private_key !== 'string') return 'unreadable';
        return {
            clientEmail: key.client_email,
            privateKey: key.private_key,
            keyId: typeof key.private_key_id === 'string' ? key.private_key_id : undefined,
            tokenUri: typeof key.token_uri === 'string' ? key.token_uri : TOKEN_URI,
        };
    } catch {
        return 'unreadable';
    }
}

// Read once for each value the environment holds, not on every request.
let parsed: { raw: string | undefined; account: ReturnType<typeof parseAccount> } | null = null;
function readAccount(raw: string | undefined): ReturnType<typeof parseAccount> {
    if (!parsed || parsed.raw !== raw) parsed = { raw, account: parseAccount(raw) };
    return parsed.account;
}

// The account to sign in with, or null when read-aloud is off: switched off
// (SPEAK=off, which says nothing), not set up yet (a line a minute at most),
// or set up with something that isn't a key file (an error: the owner's to
// fix). The route asks before counting a visitor, so nothing is spent on a
// request that can't be read.
export function speakAccount(): Account | null {
    const flag = (process.env.SPEAK ?? '').trim().toLowerCase();
    if (flag === '0' || flag === 'false' || flag === 'off') return null;
    const account = readAccount(process.env.GOOGLE_TTS_SERVICE_ACCOUNT);
    if (account === 'missing') {
        logRefusal('speak_unavailable', 'speak not_set_up', { why: 'not_set_up' });
        return null;
    }
    if (account === 'unreadable') {
        logEvent('config_error', { missing: 'GOOGLE_TTS_SERVICE_ACCOUNT', why: 'unreadable' }, 'error');
        return null;
    }
    return account;
}

// Busy (429) or down (5xx) passes on its own. Anything else, such as the API
// switched off for the account's project, billing off, or a key revoked, the
// owner has to fix, so it's an error, which reaches Sentry (lib/log.ts), and
// read-aloud is unavailable until it's fixed, not worth asking again.
const passing = (status: number) => status === 429 || status >= 500;

// After a refusal only the owner can fix, the account isn't tried again for
// a minute: each request would only be refused, and logged, once more.
const BLOCKED_MS = 60_000;
let blocked: { account: string; until: number } | null = null;
const idOf = (account: Account) => `${account.clientEmail} ${account.tokenUri}`;
const block = (account: Account) => { blocked = { account: idOf(account), until: Date.now() + BLOCKED_MS }; };

// The access token for an account, kept until a minute before it runs out.
let token: { account: string; value: string; until: number } | null = null;

// The token, 'refused' when only the owner can fix it, or null when it may
// work next time.
async function accessToken(account: Account, signal: AbortSignal): Promise<string | 'refused' | null> {
    const id = idOf(account);
    const now = Date.now();
    if (token?.account === id && token.until > now) return token.value;

    const segment = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const iat = Math.floor(now / 1000);
    const unsigned = `${segment({ alg: 'RS256', typ: 'JWT', ...(account.keyId ? { kid: account.keyId } : {}) })}.${segment({
        iss: account.clientEmail, scope: SCOPE, aud: account.tokenUri, iat, exp: iat + 3600,
    })}`;
    let assertion: string;
    try {
        assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(account.privateKey).toString('base64url')}`;
    } catch (error) {
        // The private key isn't one. Its name only: never the key.
        logEvent('config_error', { missing: 'GOOGLE_TTS_SERVICE_ACCOUNT', why: 'unsigned', error: error instanceof Error ? error.name : typeof error }, 'error');
        block(account);
        return 'refused';
    }

    const res = await fetch(account.tokenUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
        signal,
    });
    if (!res.ok) {
        void res.body?.cancel();
        if (passing(res.status)) {
            logEvent('upstream_error', { upstream: 'google_oauth', status: res.status }, 'warn');
            return null;
        }
        logEvent('upstream_error', { upstream: 'google_oauth', status: res.status }, 'error');
        block(account);
        return 'refused';
    }
    const data = await res.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof data.access_token !== 'string' || data.access_token === '') {
        logEvent('upstream_error', { upstream: 'google_oauth', why: 'no_token' }, 'warn');
        return null;
    }
    const seconds = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    token = { account: id, value: data.access_token, until: now + Math.max(0, seconds - 60) * 1000 };
    return data.access_token;
}

export type Spoken =
    | { kind: 'audio'; audio: Uint8Array<ArrayBuffer> }
    // Off, not set up, refused until the owner fixes it, or the day's
    // characters spent: not worth asking again soon.
    | { kind: 'unavailable' }
    | { kind: 'failed' }       // may work next time
    | { kind: 'aborted' };     // the page went away

// `text` is checked by the route: trimmed, within MAX_SPEAK_CHARS, and in a
// script the language's voice reads (speakable in ./voice.ts).
export async function synthesize(text: string, lang: SpeakLang, signal?: AbortSignal): Promise<Spoken> {
    const account = speakAccount();
    if (!account) return { kind: 'unavailable' };
    if (blocked?.account === idOf(account) && blocked.until > Date.now()) return { kind: 'unavailable' };
    if (!speakAllowance.spend(text.length)) {
        // This server's ceiling for the day.
        logEvent('speak_ceiling', { chars: text.length }, 'warn');
        return { kind: 'unavailable' };
    }

    const voice = speakVoice(lang);
    const started = Date.now();
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const either = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
        const bearer = await accessToken(account, either);
        if (bearer === 'refused') return { kind: 'unavailable' };
        if (!bearer) return { kind: 'failed' };
        const base = process.env.GOOGLE_TTS_BASE_URL?.trim() || API;
        const res = await fetch(`${base}/v1/text:synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
            body: JSON.stringify({ input: { text }, voice, audioConfig: { audioEncoding: 'MP3' } }),
            signal: either,
        });
        if (!res.ok) {
            // Never the body: it can quote the request.
            void res.body?.cancel();
            logEvent('upstream_error', { upstream: 'cloud_tts', status: res.status }, passing(res.status) ? 'warn' : 'error');
            // A token Google no longer takes: sign in afresh next time.
            if (res.status === 401) {
                token = null;
                return { kind: 'failed' };
            }
            if (passing(res.status)) return { kind: 'failed' };
            // The API switched off, billing off, a voice that doesn't exist.
            block(account);
            return { kind: 'unavailable' };
        }
        const data = await res.json() as { audioContent?: unknown };
        const audio = typeof data.audioContent === 'string' ? new Uint8Array(Buffer.from(data.audioContent, 'base64')) : null;
        if (!audio || audio.byteLength === 0) {
            logEvent('upstream_error', { upstream: 'cloud_tts', why: 'no_audio' }, 'warn');
            return { kind: 'failed' };
        }
        // What a call cost: its characters. Never the text.
        logEvent('tts_call', { lang, voice: voice.name, chars: text.length, bytes: audio.byteLength, ms: Date.now() - started });
        return { kind: 'audio', audio };
    } catch (error) {
        if (signal?.aborted) return { kind: 'aborted' };
        // The name only, as in ./cloud.ts.
        logEvent('upstream_error', { upstream: 'cloud_tts', error: error instanceof Error ? error.name : typeof error }, 'warn');
        return { kind: 'failed' };
    }
}
