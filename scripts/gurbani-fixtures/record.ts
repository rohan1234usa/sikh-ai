// Records the GurbaniNow answers the Gurbani tests replay, so they exercise
// real scripture text with no network. Gurbani in the fixtures always comes
// from here — never typed by hand.
//
//   npm run fixtures:gurbani                   everything
//   npm run fixtures:gurbani -- --only verify  the quote checker's lookups
//   npm run fixtures:gurbani -- --only shabad  whole shabads
//   npm run fixtures:gurbani -- --only search  Shabad Search's lookups
//
// verify: runs the real verifier over tests/gurbani/fixtures/replies.json
// with a client that saves every response (gurbaninow.json). Rerun after
// changing the extraction or search plan: the tests fail loudly on any
// lookup the fixtures don't cover.
//
// shabad: saves the /shabad/{id} payloads in SHABADS (shabads.json), without
// the fields the site never reads, plus the source's own Ang for the lines
// around each change of Ang, so the tests can hold the parser's Angs to it.
//
// search: runs every search in tests/gurbani/search-fixtures.ts through the
// real verse search, Sri Guru Granth Sahib Ji only, and saves each lookup it
// makes (search.json). Its top hits are printed for review. Rerun after
// changing the search plan or the fixtures.
//
// GurbaniNow turns away bursts (about 36 quick calls bring "503 No available
// server" for a minute), so the shabad and search calls are paced and
// retried once. A file is saved only when every lookup in it was answered.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SGGS_SOURCE_ID } from '../../lib/gurbani/citations';
import { dailyMeter, gurbaniNow, gurbaniNowClient, type GurbaniClient, type GurbaniLine } from '../../lib/gurbani/gurbaninow';
import { classifyQuery, isSearchable } from '../../lib/gurbani/query';
import { searchVerses } from '../../lib/gurbani/search';
import { verifyReply } from '../../lib/gurbani/verify';
import { angKey, searchKey } from '../../tests/gurbani/keys';
import { inputOf, SEARCHES } from '../../tests/gurbani/search-fixtures';
import { pacedCalls } from './pace';

const DIR = resolve(import.meta.dirname, '../../tests/gurbani/fixtures');
const BASE = 'https://api.gurbaninow.com/v2';

// 823 runs from Ang 10 onto Ang 11; DMP opens the Granth, so it has no
// previous shabad; 4Z1 sits within Ang 394; Q5K starts at the foot of Ang 394
// and runs onto 395.
const SHABADS = ['823', 'DMP', '4Z1', 'Q5K'];

const MODES = ['verify', 'shabad', 'search'] as const;
type Mode = (typeof MODES)[number];

function chosenModes(): Mode[] {
    const at = process.argv.indexOf('--only');
    if (at === -1) return [...MODES];
    const mode = process.argv[at + 1];
    if (!MODES.includes(mode as Mode)) throw new Error(`--only takes one of: ${MODES.join(', ')}`);
    return [mode as Mode];
}

function save(file: string, recorded: Record<string, unknown>): void {
    const sorted = Object.fromEntries(Object.entries(recorded).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(`${DIR}/${file}`, JSON.stringify(sorted, null, 1) + '\n', 'utf8');
    console.log(`\nSaved ${Object.keys(sorted).length} recorded lookups to ${file}.`);
}

async function recordVerify(): Promise<boolean> {
    const replies = JSON.parse(readFileSync(`${DIR}/replies.json`, 'utf8')) as { id: string; text: string }[];
    const recorded: Record<string, GurbaniLine[] | null> = {};
    const recorder: GurbaniClient = {
        async fetchAng(ang, signal) {
            const lines = await gurbaniNow.fetchAng(ang, signal);
            recorded[angKey(ang)] = lines;
            return lines;
        },
        async searchLines(query, type, results, signal) {
            const lines = await gurbaniNow.searchLines(query, type, results, signal);
            recorded[searchKey(query, type, results)] = lines;
            return lines;
        },
    };

    for (const reply of replies) {
        const citations = await verifyReply(reply.text, { client: recorder, maxOutbound: 50 });
        console.log(reply.id);
        for (const c of citations) {
            const where = c.line ? `${c.line.source.name}, ${c.line.ang} · ${c.line.writer} · ${c.line.gurmukhi}` : '—';
            console.log(`   ${c.status}${c.exact === false ? ' (spelling differs)' : ''}${c.citedAng ? ` [cited ${c.citedAng}]` : ''}  ${c.quote}  →  ${where}`);
        }
    }

    // A null is an outage during recording; saving it would teach the tests
    // that the source was down.
    const failed = Object.entries(recorded).filter(([, lines]) => lines === null).map(([key]) => key);
    if (failed.length) {
        console.error(`\nGurbaniNow did not answer: ${failed.join(', ')}. Nothing saved; try again.`);
        return false;
    }
    save('gurbaninow.json', recorded);
    return true;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? v as Json : {});

// One GET of GurbaniNow's JSON, or null when it went unanswered.
async function fetchJson(url: string): Promise<Json | null> {
    try {
        const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
        if (res.ok) return obj(await res.json());
        console.error(`   ${res.status} for ${url}`);
    } catch (error) {
        console.error(`   ${error instanceof Error ? error.name : 'error'} for ${url}`);
    }
    return null;
}

// What the site reads of a shabad, and no more: the legacy-font Gurmukhi,
// larivaar, the Spanish, Punjabi and Devanagari, and the first letters are
// left out to keep the file small.
function slimShabad(data: Json): Json {
    const pick = (v: unknown, keys: string[]) => Object.fromEntries(keys.filter(k => k in obj(v)).map(k => [k, obj(v)[k]]));
    const info = obj(data.shabadinfo);
    return {
        shabadinfo: {
            ...pick(info, ['shabadid', 'pageno', 'count', 'navigation']),
            source: pick(info.source, ['id', 'english', 'unicode']),
            writer: pick(info.writer, ['id', 'english', 'unicode']),
            raag: pick(info.raag, ['id', 'english', 'unicode']),
        },
        shabad: (Array.isArray(data.shabad) ? data.shabad : []).map(item => {
            const line = obj(obj(item).line);
            return {
                line: {
                    ...pick(line, ['id', 'type', 'linenum']),
                    gurmukhi: pick(line.gurmukhi, ['unicode']),
                    translation: { english: pick(obj(obj(line.translation).english), ['default']) },
                    transliteration: { english: pick(obj(obj(line.transliteration).english), ['text']) },
                },
            };
        }),
        error: data.error,
    };
}

async function recordShabads(): Promise<boolean> {
    const pace = pacedCalls({ gapMs: 400, retryMs: 2000 });
    const paced = (url: string) => pace(() => fetchJson(url));
    const recorded: Record<string, unknown> = {};
    for (const id of SHABADS) {
        const data = await paced(`${BASE}/shabad/${id}`);
        if (!data || data.error !== false || !Array.isArray(data.shabad)) {
            console.error(`\nGurbaniNow did not answer for shabad ${id}. Nothing saved; try again.`);
            return false;
        }
        recorded[`shabad:${id}`] = slimShabad(data);

        // The source's own Ang for the first and last lines, and for both
        // lines at each change of Ang.
        const lines = data.shabad.map(item => obj(obj(item).line));
        const picks = new Set([0, lines.length - 1]);
        lines.forEach((line, i) => {
            if (i > 0 && Number(line.linenum) < Number(lines[i - 1].linenum)) picks.add(i - 1).add(i);
        });
        const checked = [...picks].sort((a, b) => a - b);
        for (const i of checked) {
            const lineId = String(lines[i].id);
            const answer = await paced(`${BASE}/line/${lineId}`);
            const line = obj(answer?.line);
            if (!answer || answer.error !== false || typeof line.pageno !== 'number') {
                console.error(`\nGurbaniNow did not answer for line ${lineId}. Nothing saved; try again.`);
                return false;
            }
            recorded[`line:${lineId}`] = { id: line.id, shabadid: line.shabadid, pageno: line.pageno, lineno: line.lineno };
        }
        console.log(`shabad ${id}: ${lines.length} lines; the source's Ang checked for lines ${checked.join(', ')}`);
    }
    save('shabads.json', recorded);
    return true;
}

async function recordSearches(): Promise<boolean> {
    const pace = pacedCalls({ gapMs: 1000, retryMs: 5000 });
    const live = gurbaniNowClient({ meter: dailyMeter(Infinity), source: SGGS_SOURCE_ID });
    const recorded: Record<string, GurbaniLine[] | null> = {};
    const recorder: GurbaniClient = {
        async fetchAng() {
            throw new Error('a verse search reads no Angs');
        },
        async searchLines(query, type, results, signal) {
            const lines = await pace(() => live.searchLines(query, type, results, signal));
            recorded[searchKey(query, type, results, SGGS_SOURCE_ID)] = lines;
            return lines;
        },
    };
    for (const fixture of SEARCHES) {
        const input = inputOf(fixture);
        const query = classifyQuery(input, fixture.as);
        if (!isSearchable(query)) {
            console.log(`${fixture.id}: ${JSON.stringify(input)} is not searchable (${query.kind})`);
            continue;
        }
        const found = await searchVerses(query, { client: recorder });
        const notes = found ? [`${found.calls} lookups`, found.complete ? '' : 'incomplete', found.truncated ? 'truncated' : ''].filter(Boolean) : ['no answer'];
        console.log(`${fixture.id}: ${JSON.stringify(input)} (${query.kind}) — ${notes.join(', ')}`);
        for (const hit of found?.hits.slice(0, 3) ?? []) console.log(`   ${hit.match}  Ang ${hit.ang}  ${hit.lineId}  ${hit.gurmukhi}`);
    }
    const failed = Object.entries(recorded).filter(([, lines]) => lines === null).map(([key]) => key);
    if (failed.length) {
        console.error(`\nGurbaniNow did not answer: ${failed.join(', ')}. Nothing saved; try again.`);
        return false;
    }
    save('search.json', recorded);
    return true;
}

async function main(): Promise<void> {
    for (const mode of chosenModes()) {
        const ok = mode === 'verify' ? await recordVerify() : mode === 'shabad' ? await recordShabads() : await recordSearches();
        if (!ok) process.exitCode = 1;
    }
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
