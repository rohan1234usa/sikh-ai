// Records the GurbaniNow answers the citation tests replay. Runs the real
// verifier over tests/gurbani/fixtures/replies.json with a client that saves
// every response, so the tests exercise real scripture text with no network.
// Gurbani in the fixtures always comes from here — never typed by hand.
//
//   npm run fixtures:gurbani
//
// Rerun after changing the extraction or search plan: the tests fail loudly
// on any lookup the fixtures don't cover.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gurbaniNow, type GurbaniClient, type GurbaniLine } from '../../lib/gurbani/gurbaninow';
import { verifyReply } from '../../lib/gurbani/verify';

const DIR = resolve(import.meta.dirname, '../../tests/gurbani/fixtures');

async function main(): Promise<void> {
    const replies = JSON.parse(readFileSync(`${DIR}/replies.json`, 'utf8')) as { id: string; text: string }[];
    const recorded: Record<string, GurbaniLine[] | null> = {};
    const recorder: GurbaniClient = {
        async fetchAng(ang, signal) {
            const lines = await gurbaniNow.fetchAng(ang, signal);
            recorded[`ang:${ang}`] = lines;
            return lines;
        },
        async searchLines(query, type, results, signal) {
            const lines = await gurbaniNow.searchLines(query, type, results, signal);
            recorded[`search:${type}:${results}:${query}`] = lines;
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
        process.exitCode = 1;
        return;
    }
    const sorted = Object.fromEntries(Object.entries(recorded).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(`${DIR}/gurbaninow.json`, JSON.stringify(sorted, null, 1) + '\n', 'utf8');
    console.log(`\nSaved ${Object.keys(sorted).length} recorded lookups.`);
}

main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
