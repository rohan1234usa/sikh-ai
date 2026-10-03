// The search eval's report (report.md): the results against the bar to
// ship, by kind of search, and every case, with the ones not right in full.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { VerseHit } from '../../lib/gurbani/query';
import type { EvalCase, Tag } from './cases';

export type Outcome = {
    case: EvalCase;
    input: string;
    kind: string;
    reason?: string;
    correct: boolean;
    rank: number;         // where the right line came, 0 when it didn't
    calls: number;
    hits: VerseHit[];
    unanswered?: boolean;
    complete?: boolean;
    truncated?: boolean;
};

const REPORT_PATH = resolve(import.meta.dirname, 'report.md');

// The bar to ship: the right line in the top three for 90% of Gurmukhi
// searches and 80% of romanized ones as readers type them; nothing found
// for everything that should find nothing; at most 2.5 lookups a search.
const BAR = { gurmukhiTop3: 0.9, casualTop3: 0.8, negatives: 1, meanLookups: 2.5 };
const GURMUKHI_TAGS: Tag[] = ['gurmukhi', 'gurmukhi-loose', 'gurmukhi-part', 'gurmukhi-typo', 'letters'];

const pct = (n: number, of: number) => (of === 0 ? '—' : `${n}/${of} (${Math.round((100 * n) / of)}%)`);
const top3 = (os: Outcome[]) => os.filter(o => o.rank >= 1 && o.rank <= 3).length;
const mrr = (os: Outcome[]) => (os.length === 0 ? 0 : os.reduce((sum, o) => sum + (o.rank >= 1 && o.rank <= 10 ? 1 / o.rank : 0), 0) / os.length);
const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
function quantile(xs: number[], q: number): number {
    if (xs.length === 0) return NaN;
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}
const cell = (text: string) => text.replace(/\|/g, '\\|');
const hitLine = (h: VerseHit) => `Ang ${h.ang ?? '?'} · ${h.lineId} · ${h.match} · ${h.gurmukhi}`;

export function writeReport(outcomes: Outcome[], run: { live: number; times: number[]; full: boolean }): string {
    const positives = outcomes.filter(o => o.case.tag !== 'negative' && o.case.tag !== 'ang');
    const gurmukhi = positives.filter(o => GURMUKHI_TAGS.includes(o.case.tag));
    const casual = positives.filter(o => o.case.tag === 'roman-casual');
    const negatives = outcomes.filter(o => o.case.tag === 'negative');
    const angs = outcomes.filter(o => o.case.tag === 'ang');
    const searched = outcomes.filter(o => o.calls > 0);
    const lookups = searched.map(o => o.calls);
    const times = run.times;

    const meanLookups = mean(lookups);
    const rows: [string, string, string, boolean][] = [
        ['Gurmukhi: the right line in the top three', pct(top3(gurmukhi), gurmukhi.length), `${BAR.gurmukhiTop3 * 100}%`, top3(gurmukhi) >= BAR.gurmukhiTop3 * gurmukhi.length],
        ['Romanized as readers type it: in the top three', pct(top3(casual), casual.length), `${BAR.casualTop3 * 100}%`, top3(casual) >= BAR.casualTop3 * casual.length],
        ['Nothing to find, and nothing found', pct(negatives.filter(o => o.correct).length, negatives.length), '100%', negatives.every(o => o.correct)],
        ['Lookups per search, on average', meanLookups.toFixed(2), `≤ ${BAR.meanLookups}`, meanLookups <= BAR.meanLookups],
    ];

    const tags = [...new Set(outcomes.map(o => o.case.tag))];
    const byTag = tags.map((tag) => {
        const os = outcomes.filter(o => o.case.tag === tag);
        if (tag === 'negative' || tag === 'ang') return `| ${tag} | ${os.length} | ${pct(os.filter(o => o.correct).length, os.length)} | | | ${mean(os.map(o => o.calls)).toFixed(1)} |`;
        return `| ${tag} | ${os.length} | ${pct(os.filter(o => o.rank === 1).length, os.length)} | ${pct(top3(os), os.length)} | ${mrr(os).toFixed(2)} | ${mean(os.map(o => o.calls)).toFixed(1)} |`;
    });

    const every = outcomes.map((o) => {
        const at = o.case.tag === 'ang' ? (o.correct ? 'opens its Ang' : '✗')
            : o.case.expect.none ? (o.correct ? (o.reason ? `declined (${o.reason})` : 'nothing found') : `✗ ${o.hits.length} found`)
            : o.rank ? `${o.rank === 1 ? '' : '✗ '}${o.rank}` : '✗ not found';
        const notes = [o.unanswered ? 'unanswered' : '', o.complete === false ? 'incomplete' : '', o.truncated ? 'truncated' : ''].filter(Boolean).join(', ');
        return `| ${o.case.id} | ${o.case.tag} | ${cell(o.input)} | ${o.kind} | ${at} | ${o.calls} | ${cell(o.hits[0] ? hitLine(o.hits[0]) : '—')} | ${notes} |`;
    });

    const wrong = outcomes.filter(o => !o.correct).map(o => [
        `### ${o.case.id}`,
        '',
        `Typed \`${o.input}\`, read as ${o.kind}${o.reason ? ` (${o.reason})` : ''}. Expected ${o.case.expect.none ? 'nothing' : `line ${o.case.expect.lineId ?? '?'} on Ang ${o.case.expect.ang ?? o.case.expect.angPage}`}; ${o.calls} lookups.`,
        '',
        ...(o.hits.length ? o.hits.slice(0, 3).map((h, i) => `${i + 1}. ${hitLine(h)}`) : ['Nothing found.']),
        '',
    ].join('\n'));

    const report = [
        '# Search eval',
        '',
        `${outcomes.length} searches through the real verse search (\`lib/gurbani/search.ts\`) against the live GurbaniNow API, Sri Guru Granth Sahib Ji only, as \`/api/shabad/search\` runs it. Run on ${new Date().toISOString().slice(0, 10)}${run.full ? '' : ' (a subset of the cases)'}, with ${run.live} lookups made live and the rest from the cache. Gurmukhi searches are cut from pinned lines of the live source; romanized ones are typed as readers type them (\`scripts/search-eval/cases.ts\`).`,
        '',
        '## Against the bar to ship',
        '',
        '| | Result | Bar | |',
        '| --- | --- | --- | --- |',
        ...rows.map(([what, result, bar, ok]) => `| ${what} | ${result} | ${bar} | ${ok ? '✓' : '✗'} |`),
        '',
        `Overall, the right line came first in ${pct(positives.filter(o => o.rank === 1).length, positives.length)} of the searches that had one to find (MRR@10 ${mrr(positives).toFixed(2)}); Ang numbers opened their Ang in ${pct(angs.filter(o => o.correct).length, angs.length)}.`,
        `Lookups per search: mean ${meanLookups.toFixed(2)}, p95 ${quantile(lookups, 0.95)}, most ${Math.max(0, ...lookups)}. ${times.length ? `GurbaniNow answered a lookup in ${Math.round(quantile(times, 0.5))} ms (median), ${Math.round(quantile(times, 0.95))} ms (p95), over ${times.length} live lookups. The site runs a wave's lookups together, so a search takes about that per wave; the eval paces them a second apart.` : 'Every lookup came from the cache, so nothing was timed.'}`,
        `Unanswered: ${outcomes.filter(o => o.unanswered).length}; incomplete: ${outcomes.filter(o => o.complete === false).length}; truncated: ${outcomes.filter(o => o.truncated).length}.`,
        '',
        '## By kind of search',
        '',
        '| Kind | Cases | First (or right) | Top three | MRR@10 | Lookups |',
        '| --- | --- | --- | --- | --- | --- |',
        ...byTag,
        '',
        '## Every case',
        '',
        '| Case | Kind | Typed | Read as | Right line at | Lookups | First hit | |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        ...every,
        '',
        ...(wrong.length ? ['## Not right', '', ...wrong] : ['Every case was right.', '']),
    ].join('\n');
    writeFileSync(REPORT_PATH, report, 'utf8');
    return REPORT_PATH;
}
