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
// The route asks speakReady() before it counts a visitor, so nothing is spent
// on a line that can't be read, then hands what it found to synthesize().
// Like ./cloud.ts it's on a request path, so it times out fast, meters
// itself, never throws, and never logs the text or the key.

import { createPrivateKey, createSign, type KeyObject } from 'node:crypto';
import { DAY_MS } from '../api/allowance';
import { logRefusal } from '../api/refusals';
import { logEvent } from '../log';
import { charAllowance, passingStatus, switchedOff } from './cloud';
import type { SpeakLang } from './voice';

const API = 'https://texttospeech.googleapis.com';
const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const TIMEOUT_MS = 8000;

// Best-effort, like Cloud Translation's (./cloud.ts): each warm server keeps
// its own count, and a cold start resets it. 50,000 characters is a few
// hundred translations read aloud, about $0.20 a day at $4 a million. One
// visitor's day is a quarter of it (VISITOR_LIMITS.speak in
// lib/api/allowance.ts).
export const SPEAK_DAILY_CHAR_CEILING = 50_000;
export const speakAllowance = charAllowance(SPEAK_DAILY_CHAR_CEILING);

// Punjabi's voices that are generally available are pa-IN Standard and
// WaveNet, A to D (Chirp 3 HD has pa-IN only in Preview). English is
// normally read by the visitor's own device; this voice is for a device
// that can't. SPEAK_VOICE_PA and SPEAK_VOICE_EN choose others by name.
const DEFAULT_VOICES: Record<SpeakLang, string> = { pa: 'pa-IN-Wavenet-A', en: 'en-US-Wavenet-F' };
const VOICE_ENV: Record<SpeakLang, string> = { pa: 'SPEAK_VOICE_PA', en: 'SPEAK_VOICE_EN' };

type Voice = { languageCode: string; name: string };

function speakVoice(lang: SpeakLang): Voice {
    const name = process.env[VOICE_ENV[lang]]?.trim() || DEFAULT_VOICES[lang];
    // A voice's name starts with its language: pa-IN-Wavenet-A is pa-IN.
    return { languageCode: name.split('-').slice(0, 2).join('-'), name };
}

type Account = { clientEmail: string; privateKey: KeyObject; keyId?: string; tokenUri: string };

function parseAccount(raw: string | undefined): Account | 'missing' | 'unreadable' {
    const text = raw?.trim();
    if (!text) return 'missing';
    try {
        const json = text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8');
        const key = JSON.parse(json) as Record<string, unknown>;
        if (typeof key.client_email !== 'string' || typeof key.private_key !== 'string') return 'unreadable';
        // Read here, once. A key mangled in pasting (its newlines escaped
        // twice, say) will never sign until the owner fixes the variable, so
        // read-aloud is off until then, not held back a minute at a time.
        const privateKey = createPrivateKey(key.private_key);
        if (privateKey.asymmetricKeyType !== 'rsa') return 'unreadable';
        return {
            clientEmail: key.client_email,
            privateKey,
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
// or set up with something that isn't a working key file (an error: the
// owner's to fix, written once a minute for each value at most).
let unreadableLogged: { raw: string | undefined; minute: number } | null = null;
function speakAccount(now: number): Account | null {
    if (switchedOff('SPEAK')) return null;
    const raw = process.env.GOOGLE_TTS_SERVICE_ACCOUNT;
    const account = readAccount(raw);
    if (account === 'missing') {
        logRefusal('speak_unavailable', 'speak not_set_up', { why: 'not_set_up' }, now);
        return null;
    }
    if (account === 'unreadable') {
        const minute = Math.floor(now / 60_000);
        if (!unreadableLogged || unreadableLogged.raw !== raw || unreadableLogged.minute !== minute) {
            unreadableLogged = { raw, minute };
            logEvent('config_error', { missing: 'GOOGLE_TTS_SERVICE_ACCOUNT', why: 'unreadable' }, 'error');
        }
        return null;
    }
    return account;
}

// Why a line can't be read now, and when to ask again, which the route sends
// as Retry-After and the page waits out. Every case passes on its own or can
// be fixed without the page knowing, so every one carries a time: off or not
// set up, ten minutes (the owner may switch it on); held back (below), the
// rest of the minute; this server's characters spent, a few minutes.
export type Unavailable = { kind: 'unavailable'; retryAfter: number };

const seconds = (ms: number) => Math.max(1, Math.ceil(ms / 1000));
const OFF_RETRY_S = 600;

// After a refusal about the account rather than the line (sign-in refused, a
// key that can't sign, the API or billing switched off for its project), the
// account isn't tried again for a minute: each request would only be
// refused, and logged, once more.
const BLOCKED_MS = 60_000;
let blocked: { account: string; until: number } | null = null;
const idOf = (account: Account) => `${account.clientEmail} ${account.tokenUri}`;

function block(account: Account): Unavailable {
    blocked = { account: idOf(account), until: Date.now() + BLOCKED_MS };
    return { kind: 'unavailable', retryAfter: seconds(BLOCKED_MS) };
}

// This server's characters for the day can't take the line. Each warm server
// keeps its own count, so another (or this one after a cold start) may have
// room: with nothing left, a page waits a quarter of an hour at most, not
// until midnight UTC; a line merely too long for what is left fails alone,
// and shorter ones are still read. Logged a line a minute at most.
const CEILING_RETRY_S = 15 * 60;
function overCeiling(chars: number, now: number): Unavailable | { kind: 'failed' } {
    logRefusal('speak_ceiling', 'speak ceiling', { chars }, now);
    if (speakAllowance.remaining() > 0) return { kind: 'failed' };
    const toMidnight = seconds((Math.floor(now / DAY_MS) + 1) * DAY_MS - now);
    return { kind: 'unavailable', retryAfter: Math.min(toMidnight, CEILING_RETRY_S) };
}

// Whether a line of `chars` characters can be read now, and the account to
// read it with; or why not, before anyone is counted.
export function speakReady(chars: number): { kind: 'ready'; account: Account } | Unavailable | { kind: 'failed' } {
    const now = Date.now();
    const account = speakAccount(now);
    if (!account) return { kind: 'unavailable', retryAfter: OFF_RETRY_S };
    if (blocked?.account === idOf(account) && blocked.until > now) return { kind: 'unavailable', retryAfter: seconds(blocked.until - now) };
    if (speakAllowance.remaining() < chars) return overCeiling(chars, now);
    return { kind: 'ready', account };
}

// The access token for an account, kept until a minute before it runs out.
let token: { account: string; value: string; until: number } | null = null;

// The token; the account held back, when only the owner can fix it; or null
// when it may work next time.
async function accessToken(account: Account, signal: AbortSignal): Promise<string | Unavailable | null> {
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
        // A key read as RSA that still won't sign (parseAccount checks it):
        // held back, as a refusal is. Its name only: never the key.
        logEvent('config_error', { missing: 'GOOGLE_TTS_SERVICE_ACCOUNT', why: 'unsigned', error: error instanceof Error ? error.name : typeof error }, 'error');
        return block(account);
    }

    const res = await fetch(account.tokenUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
        signal,
    });
    if (!res.ok) {
        void res.body?.cancel();
        if (passingStatus(res.status)) {
            logEvent('upstream_error', { upstream: 'google_oauth', status: res.status }, 'warn');
            return null;
        }
        logEvent('upstream_error', { upstream: 'google_oauth', status: res.status }, 'error');
        return block(account);
    }
    const data = await res.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof data.access_token !== 'string' || data.access_token === '') {
        logEvent('upstream_error', { upstream: 'google_oauth', why: 'no_token' }, 'warn');
        return null;
    }
    const lifetime = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    token = { account: id, value: data.access_token, until: now + Math.max(0, lifetime - 60) * 1000 };
    return data.access_token;
}

export type Spoken =
    | { kind: 'audio'; audio: Uint8Array<ArrayBuffer> }
    | Unavailable
    | { kind: 'failed' }       // this line; the next may work
    | { kind: 'aborted' };     // the page went away

// `text` is checked by the route: trimmed, within MAX_SPEAK_CHARS, and in a
// script the language's voice reads (speakable in ./voice.ts). `account` is
// what speakReady() found.
export async function synthesize(account: Account, text: string, lang: SpeakLang, signal?: AbortSignal): Promise<Spoken> {
    // Charged before the request, as ./cloud.ts is. speakReady() saw room,
    // and nothing runs between the two: the route calls this straight after.
    speakAllowance.spend(text.length);

    const voice = speakVoice(lang);
    const started = Date.now();
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const either = signal ? AbortSignal.any([signal, timeout]) : timeout;
    // Which service a thrown error came from: the sign-in, until there is a
    // token, then Text-to-Speech.
    let upstream: 'google_oauth' | 'cloud_tts' = 'google_oauth';
    try {
        const bearer = await accessToken(account, either);
        if (bearer === null) return { kind: 'failed' };
        if (typeof bearer !== 'string') return bearer;
        upstream = 'cloud_tts';
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
            logEvent('upstream_error', { upstream: 'cloud_tts', status: res.status }, passingStatus(res.status) ? 'warn' : 'error');
            // A token Google no longer takes: sign in afresh next time.
            if (res.status === 401) {
                token = null;
                return { kind: 'failed' };
            }
            // The account refused: the API or billing switched off for its
            // project, or no permission to use it.
            if (res.status === 403) return block(account);
            // Busy or down, or this one line refused (a 400): the next may
            // be read. A 400 for every line, such as a voice name that
            // doesn't exist, is still an error the owner hears about.
            return { kind: 'failed' };
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
        logEvent('upstream_error', { upstream, error: error instanceof Error ? error.name : typeof error }, 'warn');
        return { kind: 'failed' };
    }
}
